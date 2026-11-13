"""
Chatbot de PetroHelp (IA gratuita local con herramientas).

- Consulta sensores ESP32, alertas y tickets con datos reales.
- Crea tickets cuando el usuario reporta un problema.

Todas las llamadas a Django se hacen CON EL TOKEN DEL USUARIO que chatea,
así se respetan sus permisos: un operador solo ve sus tickets, y el
admin_global no puede crear tickets (igual que en la página).
"""
import json
import logging
from datetime import datetime, timezone

import httpx

from . import config, db, llm, reglas

log = logging.getLogger("chat")
MAX_PASOS = 6

SISTEMA = """Eres "PetroBot", el asistente de PetroHelp, un sistema de gestión de incidencias para gasolineras.
Respondes en español, de forma breve, clara y amable.

Puedes:
- Consultar el estado de los sensores ESP32 (temperatura, gas, nivel de tanque) y sus alertas.
- Consultar, resumir y buscar tickets.
- Crear tickets cuando el usuario reporta un problema.

Reglas:
- Usa SIEMPRE las herramientas para obtener datos; nunca inventes valores, tickets ni ids.
- Para crear un ticket necesitas: qué pasó, en qué estación y la categoría. Si falta la estación
  o no está claro el problema, pregunta antes de crearlo. Elige tú la categoría y la prioridad
  (alta = riesgo para personas o fuga/derrame; media = afecta la operación; baja = menor).
- Antes de crear el ticket, resume en una línea lo que vas a registrar y créalo; después da el número.
- Si una herramienta devuelve error de permisos, explícalo de forma sencilla.
- Hoy es {hoy}. El usuario es {usuario} (rol: {rol})."""


HERRAMIENTAS_DISPOSITIVOS = [
    {
        "name": "estado_dispositivos",
        "description": "Estado actual de todos los sensores ESP32: en línea, última lectura y alertas de 24 h.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "lecturas_dispositivo",
        "description": "Historial reciente de lecturas de un dispositivo, para ver tendencias.",
        "input_schema": {
            "type": "object",
            "properties": {
                "device_id": {"type": "string"},
                "limite": {"type": "integer", "description": "Cuántas lecturas (máx. 50)", "default": 20},
            },
            "required": ["device_id"],
        },
    },
    {
        "name": "alertas_recientes",
        "description": "Últimas alertas de sensores y si generaron ticket.",
        "input_schema": {
            "type": "object",
            "properties": {"limite": {"type": "integer", "default": 15}},
        },
    },
]

HERRAMIENTAS_TICKETS = [
    {
        "name": "listar_tickets",
        "description": "Lista los tickets visibles para el usuario, con filtros opcionales.",
        "input_schema": {
            "type": "object",
            "properties": {
                "estado": {"type": "string", "enum": ["abierto", "en_proceso", "cerrado"]},
                "prioridad": {"type": "string", "enum": ["baja", "media", "alta"]},
                "buscar": {"type": "string", "description": "Texto a buscar en título/descripción"},
                "limite": {"type": "integer", "default": 20},
            },
        },
    },
    {
        "name": "ver_ticket",
        "description": "Detalle completo de un ticket, con comentarios e historial.",
        "input_schema": {
            "type": "object",
            "properties": {"ticket_id": {"type": "integer"}},
            "required": ["ticket_id"],
        },
    },
    {
        "name": "catalogos",
        "description": "Lista de estaciones y categorías (con su departamento). Úsala antes de crear un ticket.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "crear_ticket",
        "description": "Crea un ticket de incidencia a nombre del usuario.",
        "input_schema": {
            "type": "object",
            "properties": {
                "titulo": {"type": "string", "description": "Máx. 100 caracteres"},
                "descripcion": {"type": "string"},
                "categoria_id": {"type": "integer"},
                "estacion_id": {"type": "integer"},
                "prioridad": {"type": "string", "enum": ["baja", "media", "alta"]},
            },
            "required": ["titulo", "descripcion", "categoria_id", "estacion_id", "prioridad"],
        },
    },
]


# =========================================================
# Ejecución de herramientas
# =========================================================
async def _django(token: str, metodo: str, ruta: str, **kw):
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.request(
            metodo, f"{config.DJANGO_API_URL}{ruta}",
            headers={"Authorization": f"Token {token}"}, **kw,
        )
    if r.status_code == 403:
        return {"error": "Permiso denegado por PetroHelp para esta acción con tu rol."}
    if r.status_code >= 400:
        return {"error": f"Django respondió {r.status_code}: {r.text[:300]}"}
    datos = r.json()
    if isinstance(datos, dict) and "results" in datos:
        datos = datos["results"]
    return datos


def _resumen_ticket(t: dict) -> dict:
    return {k: t.get(k) for k in (
        "id", "titulo", "estado", "prioridad", "estacion_nombre", "categoria_nombre",
        "departamento_nombre", "creado_por_nombre", "fecha_registro",
    )}


async def ejecutar(nombre: str, args: dict, token: str, ctx: dict):
    if nombre == "estado_dispositivos":
        salida = []
        for d in config.DISPOSITIVOS.values():
            ult = db.ultimas_lecturas(d["device_id"], 1)
            ult = ult[0] if ult else None
            en_linea = False
            if ult:
                delta = datetime.now(timezone.utc) - datetime.fromisoformat(ult["ts"])
                en_linea = delta.total_seconds() < config.SEGUNDOS_FUERA_DE_LINEA
            salida.append({
                "device_id": d["device_id"], "nombre": d.get("nombre"),
                "estacion_id": d.get("estacion_id"), "en_linea": en_linea,
                "ultima_lectura": ult and {k: ult[k] for k in ("ts", "temperatura", "gas_ppm", "nivel_tanque")},
                "alertas_24h": db.alertas_recientes_count(d["device_id"]),
                "umbrales": {**reglas.UMBRALES_DEFAULT, **(d.get("umbrales") or {})},
            })
        return salida

    if nombre == "lecturas_dispositivo":
        dev = args.get("device_id")
        if dev not in config.DISPOSITIVOS:
            return {"error": f"No existe el dispositivo {dev}. Disponibles: {list(config.DISPOSITIVOS)}"}
        filas = db.ultimas_lecturas(dev, min(int(args.get("limite", 20)), 50))
        return [{k: f[k] for k in ("ts", "temperatura", "gas_ppm", "nivel_tanque")} for f in filas]

    if nombre == "alertas_recientes":
        filas = db.listar_alertas(min(int(args.get("limite", 15)), 50))
        return [{k: f[k] for k in ("ts", "device_id", "mensaje", "severidad", "ticket_id", "decision")} for f in filas]

    if nombre == "listar_tickets":
        params = {}
        if args.get("buscar"):
            params["search"] = args["buscar"]
        datos = await _django(token, "GET", "/tickets/", params=params)
        if isinstance(datos, dict):
            return datos
        if args.get("estado"):
            datos = [t for t in datos if t.get("estado") == args["estado"]]
        if args.get("prioridad"):
            datos = [t for t in datos if t.get("prioridad") == args["prioridad"]]
        limite = min(int(args.get("limite", 20)), 50)
        return {"total": len(datos), "tickets": [_resumen_ticket(t) for t in datos[:limite]]}

    if nombre == "ver_ticket":
        t = await _django(token, "GET", f"/tickets/{int(args['ticket_id'])}/")
        if "error" in t:
            return t
        return {
            **_resumen_ticket(t),
            "descripcion": t.get("descripcion"),
            "comentarios": [{"usuario": c.get("usuario_nombre") or c.get("usuario"), "texto": c.get("comentario"), "fecha": c.get("fecha")} for c in t.get("comentarios", [])],
            "historial": t.get("historial", []),
        }

    if nombre == "catalogos":
        est = await _django(token, "GET", "/estaciones/")
        cat = await _django(token, "GET", "/categorias/")
        return {
            "estaciones": est if isinstance(est, dict) else [{"id": e["id"], "nombre": e["nombre"]} for e in est if e.get("activa", True)],
            "categorias": cat if isinstance(cat, dict) else [{"id": c["id"], "nombre": c["nombre"], "departamento": c.get("departamento_nombre")} for c in cat],
        }

    if nombre == "crear_ticket":
        t = await _django(token, "POST", "/tickets/", json={
            "titulo": args["titulo"][:150],
            "descripcion": args["descripcion"] + "\n\n— Registrado mediante PetroBot.",
            "categoria": args["categoria_id"],
            "estacion": args["estacion_id"],
            "prioridad": args["prioridad"],
        })
        if "error" in t:
            return t
        ctx["tickets_creados"].append(t["id"])
        return {"ok": True, "ticket_id": t["id"], "titulo": t.get("titulo")}

    return {"error": f"Herramienta desconocida: {nombre}"}


# =========================================================
# Bucle del agente
# =========================================================
async def responder(mensajes: list[dict], usuario: dict, token: str) -> dict:
    es_admin = usuario.get("rol") in ("admin_global", "admin_departamento")
    herramientas = HERRAMIENTAS_TICKETS + (HERRAMIENTAS_DISPOSITIVOS if es_admin else [])
    sistema = SISTEMA.format(
        hoy=datetime.now().strftime("%d/%m/%Y %H:%M"),
        usuario=usuario.get("first_name") or usuario.get("username"),
        rol=usuario.get("rol"),
    )

    historial = [{"role": "system", "content": sistema}]
    historial += [{"role": m["role"], "content": m["content"]} for m in mensajes[-20:]]
    ctx = {"tickets_creados": []}

    for _ in range(MAX_PASOS):
        msg = await llm.completar(historial, herramientas)
        llamadas = msg.get("tool_calls") or []
        if not llamadas:
            texto = (msg.get("content") or "").strip()
            return {"respuesta": texto or "…", "tickets_creados": ctx["tickets_creados"]}

        historial.append({
            "role": "assistant",
            "content": msg.get("content") or "",
            "tool_calls": llamadas,
        })
        for i, tc in enumerate(llamadas):
            nombre = tc["function"]["name"]
            try:
                res = await ejecutar(nombre, llm.argumentos(tc), token, ctx)
            except Exception as e:  # noqa: BLE001
                log.exception("Error en herramienta %s", nombre)
                res = {"error": str(e)}
            historial.append({
                "role": "tool",
                "tool_call_id": tc.get("id") or f"call_{i}",
                "name": nombre,
                "content": json.dumps(res, ensure_ascii=False, default=str)[:15000],
            })

    return {"respuesta": "Necesité demasiados pasos para responder. ¿Puedes ser más específico?",
            "tickets_creados": ctx["tickets_creados"]}
