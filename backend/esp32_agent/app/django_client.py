"""
Cliente HTTP hacia la API de Django (PetroHelp).
El agente se autentica como un usuario "operador" dedicado.
"""
import time

import httpx

from . import config

_token: str | None = config.DJANGO_AGENT_TOKEN or None
_cache_categorias: tuple[float, list] = (0.0, [])
_cache_me: dict[str, tuple[float, dict | None]] = {}


async def _obtener_token(client: httpx.AsyncClient) -> str:
    global _token
    if _token:
        return _token
    r = await client.post(
        f"{config.DJANGO_API_URL}/auth/login/",
        data={"username": config.DJANGO_AGENT_USER, "password": config.DJANGO_AGENT_PASSWORD},
    )
    r.raise_for_status()
    _token = r.json()["token"]
    return _token


async def _peticion(metodo: str, ruta: str, **kwargs) -> httpx.Response:
    global _token
    async with httpx.AsyncClient(timeout=15) as client:
        token = await _obtener_token(client)
        r = await client.request(
            metodo, f"{config.DJANGO_API_URL}{ruta}",
            headers={"Authorization": f"Token {token}"}, **kwargs,
        )
        if r.status_code == 401 and not config.DJANGO_AGENT_TOKEN:
            # Token vencido/borrado: reintenta un login una vez.
            _token = None
            token = await _obtener_token(client)
            r = await client.request(
                metodo, f"{config.DJANGO_API_URL}{ruta}",
                headers={"Authorization": f"Token {token}"}, **kwargs,
            )
        return r


async def categorias() -> list[dict]:
    """Lista de categorías [{id, nombre, departamento, ...}] (cache 5 min)."""
    global _cache_categorias
    ts, datos = _cache_categorias
    if datos and time.time() - ts < 300:
        return datos
    r = await _peticion("GET", "/categorias/")
    r.raise_for_status()
    datos = r.json()
    if isinstance(datos, dict) and "results" in datos:  # por si activan paginación
        datos = datos["results"]
    _cache_categorias = (time.time(), datos)
    return datos


async def crear_ticket(titulo: str, descripcion: str, categoria_id: int,
                       estacion_id: int, prioridad: str) -> dict:
    r = await _peticion(
        "POST", "/tickets/",
        json={
            "titulo": titulo[:150],
            "descripcion": descripcion,
            "categoria": categoria_id,
            "estacion": estacion_id,
            "prioridad": prioridad,
        },
    )
    if r.status_code >= 400:
        raise RuntimeError(f"Django rechazó el ticket ({r.status_code}): {r.text}")
    return r.json()


async def usuario_desde_token(token: str) -> dict | None:
    """Valida el token de un usuario del frontend contra /api/auth/me/ (cache 60 s)."""
    ahora = time.time()
    if token in _cache_me and ahora - _cache_me[token][0] < 60:
        return _cache_me[token][1]
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{config.DJANGO_API_URL}/auth/me/", headers={"Authorization": f"Token {token}"}
        )
    usuario = r.json() if r.status_code == 200 else None
    _cache_me[token] = (ahora, usuario)
    return usuario
