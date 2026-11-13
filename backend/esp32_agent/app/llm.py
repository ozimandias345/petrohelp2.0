"""
Cliente de IA gratuito usando la API compatible con OpenAI.

Por defecto usa OLLAMA (modelo local en tu PC, gratis y sin internet):
    LLM_BASE_URL=http://localhost:11434/v1
    LLM_MODEL=qwen2.5:7b

También funciona con servicios con plan gratis compatibles con OpenAI
(por ejemplo Groq: LLM_BASE_URL=https://api.groq.com/openai/v1 + LLM_API_KEY).
"""
import json

import httpx

from . import config


def herramientas_openai(herramientas: list[dict]) -> list[dict]:
    """Convierte nuestras herramientas {name, description, input_schema} al formato OpenAI."""
    return [
        {
            "type": "function",
            "function": {
                "name": h["name"],
                "description": h["description"],
                "parameters": h["input_schema"],
            },
        }
        for h in herramientas
    ]


async def completar(mensajes: list[dict], herramientas: list[dict] | None = None,
                    json_mode: bool = False, max_tokens: int = 1500) -> dict:
    """Devuelve el `message` de la respuesta (con `content` y/o `tool_calls`)."""
    cuerpo = {
        "model": config.LLM_MODEL,
        "messages": mensajes,
        "max_tokens": max_tokens,
        "temperature": 0.2,
    }
    if herramientas:
        cuerpo["tools"] = herramientas_openai(herramientas)
    if json_mode:
        cuerpo["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=config.LLM_TIMEOUT) as c:
        r = await c.post(
            f"{config.LLM_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {config.LLM_API_KEY}"},
            json=cuerpo,
        )
    if r.status_code >= 400:
        raise RuntimeError(f"El modelo respondió {r.status_code}: {r.text[:300]}")
    return r.json()["choices"][0]["message"]


def argumentos(tool_call: dict) -> dict:
    """Los argumentos pueden venir como texto JSON o como objeto, según el proveedor."""
    args = tool_call["function"].get("arguments") or {}
    if isinstance(args, str):
        try:
            args = json.loads(args) if args.strip() else {}
        except json.JSONDecodeError:
            args = {}
    return args
