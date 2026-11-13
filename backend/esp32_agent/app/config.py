"""
Configuración del agente ESP32 de PetroHelp.
Todo se lee de variables de entorno (archivo .env) y de dispositivos.json.
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# --- Django (PetroHelp backend) ---
DJANGO_API_URL = os.getenv("DJANGO_API_URL", "http://127.0.0.1:8000/api").rstrip("/")
# Usuario de Django con rol "operador" que firmará los tickets automáticos.
DJANGO_AGENT_USER = os.getenv("DJANGO_AGENT_USER", "agente_esp32")
DJANGO_AGENT_PASSWORD = os.getenv("DJANGO_AGENT_PASSWORD", "")
# Alternativa: pegar directamente el token del usuario agente.
DJANGO_AGENT_TOKEN = os.getenv("DJANGO_AGENT_TOKEN", "")

# --- IA gratuita (Ollama local por defecto, API compatible con OpenAI) ---
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1").rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:7b")
LLM_API_KEY = os.getenv("LLM_API_KEY", "ollama")  # Ollama no la usa
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "120"))
# Pon IA_HABILITADA=false para usar solo reglas (sin IA).
IA_HABILITADA = os.getenv("IA_HABILITADA", "true").lower() in ("1", "true", "si", "sí", "yes")

# Categoría a usar si ni la IA ni las palabras clave encuentran una.
CATEGORIA_DEFAULT_ID = int(os.getenv("CATEGORIA_DEFAULT_ID", "0") or 0)

# --- Comportamiento ---
# Minutos sin crear otro ticket por el mismo sensor del mismo dispositivo.
COOLDOWN_MINUTOS = int(os.getenv("COOLDOWN_MINUTOS", "30"))
# Segundos sin reportar para considerar un dispositivo "fuera de línea".
SEGUNDOS_FUERA_DE_LINEA = int(os.getenv("SEGUNDOS_FUERA_DE_LINEA", "120"))

DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "agente.db"))

# --- Dispositivos registrados ---
DISPOSITIVOS_PATH = BASE_DIR / os.getenv("DISPOSITIVOS_FILE", "dispositivos.json")


def cargar_dispositivos() -> dict:
    """Devuelve {device_id: {...}} a partir de dispositivos.json."""
    if not DISPOSITIVOS_PATH.exists():
        return {}
    datos = json.loads(DISPOSITIVOS_PATH.read_text(encoding="utf-8"))
    return {d["device_id"]: d for d in datos}


DISPOSITIVOS = cargar_dispositivos()
