"""
PetroHelp - Agente ESP32 (FastAPI)

Recibe lecturas de sensores de los ESP32 instalados en las gasolineras,
detecta anomalías y, con ayuda de IA, crea tickets en el backend Django.

Ejecutar:  uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
Docs:      http://localhost:8001/docs
"""
import logging

import httpx
from datetime import datetime, timezone

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import agente_ia, config, db, django_client, reglas
from . import chat as chat_ia

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("agente")

app = FastAPI(title="PetroHelp - Agente ESP32", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


@app.on_event("startup")
def _inicio():
    db.inicializar()
    log.info("Dispositivos registrados: %s", list(config.DISPOSITIVOS))
    log.info("IA %s", "HABILITADA (" + config.LLM_MODEL + " en " + config.LLM_BASE_URL + ")" if config.IA_HABILITADA else "deshabilitada: modo reglas")


# =========================================================
# Autenticación
# =========================================================
def dispositivo_autenticado(
    x_device_id: str = Header(...), x_device_key: str = Header(...)
) -> dict:
    disp = config.DISPOSITIVOS.get(x_device_id)
    if not disp or disp.get("api_key") != x_device_key:
        raise HTTPException(401, "Dispositivo no autorizado")
    if not disp.get("activo", True):
        raise HTTPException(403, "Dispositivo desactivado")
    return disp


async def usuario_admin(authorization: str = Header(...)) -> dict:
    """Usuarios del frontend: usan el mismo token de Django (Token xxx)."""
    token = authorization.removeprefix("Token ").strip()
    usuario = await django_client.usuario_desde_token(token)
    if not usuario:
        raise HTTPException(401, "Token inválido")
    if usuario.get("rol") not in ("admin_global", "admin_departamento"):
        raise HTTPException(403, "Solo administradores")
    return usuario


# =========================================================
# Esquemas
# =========================================================
class Lectura(BaseModel):
    temperatura: float | None = Field(None, description="°C")
    gas_ppm: float | None = Field(None, description="ppm aproximadas (MQ-2)")
    nivel_tanque: float | None = Field(None, ge=0, le=100, description="% de llenado")
    extra: dict | None = Field(None, description="Cualquier otro dato (rssi, voltaje, etc.)")


# =========================================================
# Procesamiento de alertas (en segundo plano)
# =========================================================
async def procesar_anomalias(disp: dict, anomalias: list[reglas.Anomalia]):
    device_id = disp["device_id"]
    error_django = ""
    try:
        categorias = await django_client.categorias()
        if not categorias:
            error_django = "No hay categorías registradas en Django."
    except Exception as e:  # noqa: BLE001
        log.error("No se pudieron obtener categorías de Django: %s", e)
        categorias = []
        error_django = f"No se pudo conectar/iniciar sesión en Django ({e}). Revisa .env (usuario/contraseña) y que Django esté corriendo."

    recientes = db.ultimas_lecturas(device_id, 10)

    for anom in anomalias:
        if db.en_cooldown(device_id, anom.sensor, config.COOLDOWN_MINUTOS):
            log.info("%s/%s en cooldown, no se crea otro ticket", device_id, anom.sensor)
            continue

        decision = await agente_ia.decidir(disp, anom, anomalias, recientes, categorias)
        ticket_id = None

        if decision["crear_ticket"] and categorias:
            try:
                ticket = await django_client.crear_ticket(
                    titulo=decision["titulo"],
                    descripcion=decision["descripcion"],
                    categoria_id=decision["categoria_id"],
                    estacion_id=disp["estacion_id"],
                    prioridad=decision["prioridad"],
                )
                ticket_id = ticket.get("id")
                log.info("Ticket #%s creado (%s) para %s/%s", ticket_id, decision["origen"], device_id, anom.sensor)
            except Exception as e:  # noqa: BLE001
                log.error("Error creando ticket: %s", e)
                decision["razonamiento"] += f" | Error al crear ticket: {e}"
        elif error_django:
            decision["razonamiento"] = error_django

        db.guardar_alerta(
            device_id, anom.sensor, anom.valor, anom.severidad, anom.mensaje,
            decision.get("origen"), decision.get("razonamiento"), ticket_id,
        )


# =========================================================
# Endpoints para el ESP32
# =========================================================
@app.post("/api/lecturas")
async def recibir_lectura(
    lectura: Lectura, tareas: BackgroundTasks, disp: dict = Depends(dispositivo_autenticado)
):
    datos = lectura.model_dump()
    db.guardar_lectura(disp["device_id"], datos["temperatura"], datos["gas_ppm"],
                       datos["nivel_tanque"], datos["extra"])

    anomalias = reglas.evaluar(datos, disp.get("umbrales"))
    if anomalias:
        tareas.add_task(procesar_anomalias, disp, anomalias)

    # Respuesta corta para que el ESP32 pueda encender un buzzer/LED.
    return {
        "ok": True,
        "alerta": bool(anomalias),
        "severidad": max((a.severidad for a in anomalias), key=["media", "alta"].index, default=None),
        "anomalias": [a.sensor for a in anomalias],
    }


# =========================================================
# Endpoints para el frontend (admins)
# =========================================================
def _en_linea(ts_iso: str | None) -> bool:
    if not ts_iso:
        return False
    delta = datetime.now(timezone.utc) - datetime.fromisoformat(ts_iso)
    return delta.total_seconds() < config.SEGUNDOS_FUERA_DE_LINEA


@app.get("/api/dispositivos")
async def listar_dispositivos(_: dict = Depends(usuario_admin)):
    salida = []
    for d in config.DISPOSITIVOS.values():
        ult = db.ultimas_lecturas(d["device_id"], 1)
        ult = ult[0] if ult else None
        salida.append({
            "device_id": d["device_id"],
            "nombre": d.get("nombre"),
            "ubicacion": d.get("ubicacion"),
            "estacion_id": d.get("estacion_id"),
            "activo": d.get("activo", True),
            "en_linea": _en_linea(ult["ts"] if ult else None),
            "ultima_lectura": ult,
            "alertas_24h": db.alertas_recientes_count(d["device_id"]),
            "umbrales": {**reglas.UMBRALES_DEFAULT, **(d.get("umbrales") or {})},
        })
    return salida


@app.get("/api/dispositivos/{device_id}/lecturas")
async def lecturas_dispositivo(device_id: str, limite: int = Query(50, le=500),
                               _: dict = Depends(usuario_admin)):
    if device_id not in config.DISPOSITIVOS:
        raise HTTPException(404, "Dispositivo no encontrado")
    return db.ultimas_lecturas(device_id, limite)


@app.get("/api/alertas")
async def alertas(limite: int = Query(50, le=500), device_id: str | None = None,
                  _: dict = Depends(usuario_admin)):
    return db.listar_alertas(limite, device_id)


# =========================================================
# Chatbot (cualquier usuario autenticado)
# =========================================================
class MensajeChat(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


class PeticionChat(BaseModel):
    mensajes: list[MensajeChat] = Field(min_length=1)


@app.post("/api/chat")
async def chat(peticion: PeticionChat, authorization: str = Header(...)):
    token = authorization.removeprefix("Token ").strip()
    usuario = await django_client.usuario_desde_token(token)
    if not usuario:
        raise HTTPException(401, "Token inválido")
    if not config.IA_HABILITADA:
        raise HTTPException(
            503, "La IA está deshabilitada (IA_HABILITADA=false en el .env del agente)."
        )
    try:
        return await chat_ia.responder(
            [m.model_dump() for m in peticion.mensajes], usuario, token
        )
    except Exception as e:  # noqa: BLE001
        log.exception("Error en chat")
        if isinstance(e, httpx.ConnectError):
            raise HTTPException(502, "No se pudo conectar con Ollama. Ábrelo y verifica que el modelo esté descargado (ollama pull " + config.LLM_MODEL + ").")
        raise HTTPException(502, f"Error al consultar la IA: {e}")


@app.get("/health")
def salud():
    return {"ok": True, "ia": config.IA_HABILITADA, "dispositivos": len(config.DISPOSITIVOS)}
