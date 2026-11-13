"""
Agente con IA: cuando las reglas detectan una anomalía, la IA (modelo local gratuito) analiza
el contexto (lecturas recientes, estación, categorías disponibles) y
decide si crear el ticket, con qué categoría, prioridad y descripción.

Si la IA está deshabilitada o falla, se usa un respaldo por reglas,
así el sistema nunca se queda sin generar alertas.
"""
import json
import logging
import unicodedata

from . import config, llm
from .reglas import Anomalia

log = logging.getLogger("agente_ia")

HERRAMIENTA = {
    "name": "decidir_ticket",
    "description": "Registra la decisión del agente sobre la anomalía detectada en la gasolinera.",
    "input_schema": {
        "type": "object",
        "properties": {
            "crear_ticket": {
                "type": "boolean",
                "description": "false solo si parece claramente un falso positivo (pico aislado, lectura imposible).",
            },
            "categoria_id": {"type": "integer", "description": "id de una de las categorías disponibles"},
            "prioridad": {"type": "string", "enum": ["baja", "media", "alta"]},
            "titulo": {"type": "string", "description": "Título corto (máx. 100 caracteres) en español"},
            "descripcion": {
                "type": "string",
                "description": "Descripción para el técnico: qué se detectó, tendencia, riesgo y acción inmediata sugerida.",
            },
            "razonamiento": {"type": "string", "description": "Por qué tomaste esta decisión (1-2 frases)."},
        },
        "required": ["crear_ticket", "categoria_id", "prioridad", "titulo", "descripcion", "razonamiento"],
    },
}

SISTEMA = """Eres el agente de monitoreo IoT de PetroHelp, un sistema de incidencias para gasolineras.
Recibes anomalías detectadas por sensores ESP32 (gas, temperatura, nivel de tanque) y decides
si se debe abrir un ticket de incidencia, a qué categoría pertenece y qué prioridad tiene.

Criterios:
- La seguridad es lo primero: posibles fugas de gas o temperaturas altas cerca de combustible son prioridad alta.
- Nivel de tanque bajo es operativo (reabastecimiento), normalmente prioridad media salvo que esté casi vacío.
- Si la lectura es un pico aislado e incoherente con las demás lecturas recientes, puede ser falso positivo.
- Elige SIEMPRE una categoria_id de la lista proporcionada.
- Escribe en español, claro y accionable para el personal de la estación.
Responde únicamente con JSON."""


def _normalizar(t: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", t.lower()) if unicodedata.category(c) != "Mn")


PALABRAS_CLAVE = {
    "gas_ppm": ["seguridad", "fuga", "gas", "emergencia", "riesgo"],
    "temperatura": ["seguridad", "electric", "mantenimiento", "equipo"],
    "nivel_tanque": ["combustible", "tanque", "abasto", "inventario", "suministro", "operacion"],
}


def _categoria_por_reglas(sensor: str, categorias: list[dict]) -> int:
    for palabra in PALABRAS_CLAVE.get(sensor, []):
        for c in categorias:
            texto = _normalizar(f"{c.get('nombre', '')} {c.get('departamento_nombre', '')}")
            if palabra in texto:
                return c["id"]
    if config.CATEGORIA_DEFAULT_ID:
        return config.CATEGORIA_DEFAULT_ID
    return categorias[0]["id"] if categorias else 0


def decision_por_reglas(dispositivo: dict, anomalia: Anomalia, categorias: list[dict]) -> dict:
    return {
        "crear_ticket": True,
        "categoria_id": _categoria_por_reglas(anomalia.sensor, categorias),
        "prioridad": anomalia.severidad,
        "titulo": f"[Sensor] {anomalia.mensaje.split(' = ')[0].capitalize()} fuera de rango - {dispositivo.get('nombre', dispositivo['device_id'])}",
        "descripcion": (
            f"Alerta automática del dispositivo {dispositivo['device_id']} "
            f"({dispositivo.get('nombre', '')}).\n\n"
            f"Detectado: {anomalia.mensaje}.\nSeveridad: {anomalia.severidad}.\n\n"
            "Ticket generado por reglas de umbral (IA no disponible)."
        ),
        "razonamiento": "Umbral superado (modo reglas).",
        "origen": "reglas",
    }


async def decidir(dispositivo: dict, anomalia: Anomalia, todas: list[Anomalia],
                  lecturas_recientes: list[dict], categorias: list[dict]) -> dict:
    if not config.IA_HABILITADA:
        return decision_por_reglas(dispositivo, anomalia, categorias)

    try:
        contexto = {
            "dispositivo": {k: dispositivo.get(k) for k in ("device_id", "nombre", "estacion_id", "ubicacion")},
            "anomalia_principal": anomalia.dict(),
            "todas_las_anomalias_de_esta_lectura": [a.dict() for a in todas],
            "lecturas_recientes_mas_nueva_primero": [
                {k: l.get(k) for k in ("ts", "temperatura", "gas_ppm", "nivel_tanque")}
                for l in lecturas_recientes
            ],
            "categorias_disponibles": [
                {"id": c["id"], "nombre": c.get("nombre"), "departamento": c.get("departamento_nombre")}
                for c in categorias
            ],
        }
        esquema = json.dumps(HERRAMIENTA["input_schema"]["properties"], ensure_ascii=False)
        msg = await llm.completar(
            [
                {"role": "system", "content": SISTEMA + "\n\nResponde SOLO con un objeto JSON con estas claves: " + esquema},
                {"role": "user", "content": json.dumps(contexto, ensure_ascii=False)},
            ],
            json_mode=True,
            max_tokens=800,
        )
        decision = json.loads(msg.get("content") or "{}")
        decision["crear_ticket"] = bool(decision.get("crear_ticket", True))
        try:
            decision["categoria_id"] = int(decision.get("categoria_id"))
        except (TypeError, ValueError):
            decision["categoria_id"] = None
        if not decision.get("titulo") or not decision.get("descripcion"):
            raise ValueError("Respuesta incompleta del modelo")
        decision.setdefault("razonamiento", "Analizado por IA.")

        # Validaciones de seguridad sobre la respuesta del modelo
        ids_validos = {c["id"] for c in categorias}
        if decision.get("categoria_id") not in ids_validos:
            decision["categoria_id"] = _categoria_por_reglas(anomalia.sensor, categorias)
        if decision.get("prioridad") not in ("baja", "media", "alta"):
            decision["prioridad"] = anomalia.severidad
        # Una fuga de gas severa nunca se descarta, diga lo que diga el modelo.
        if anomalia.sensor == "gas_ppm" and anomalia.severidad == "alta":
            decision["crear_ticket"] = True
            decision["prioridad"] = "alta"

        decision["descripcion"] = (
            decision["descripcion"].strip()
            + f"\n\n— Generado por el agente IA de PetroHelp (dispositivo {dispositivo['device_id']})."
        )
        decision["origen"] = "ia"
        return decision

    except Exception as e:  # noqa: BLE001
        log.exception("Falló la IA, usando reglas: %s", e)
        return decision_por_reglas(dispositivo, anomalia, categorias)
