# PetroHelp · Agente ESP32 (FastAPI + IA)

```
ESP32 (sensores) ──POST /api/lecturas──▶ Agente FastAPI :8001 ──▶ Reglas de umbral
                                              │                     │ anomalía
                                              │                     ▼
                                              │               Agente IA (Ollama, gratis)
                                              │      decide categoría, prioridad, texto
                                              │                     │
                                              ▼                     ▼
                                     SQLite (lecturas/alertas)   Django :8000 /api/tickets/
Frontend React ──GET /api/dispositivos, /api/alertas (token Django)──┘
```

## 1. Preparar Django

1. Crea un usuario para el agente con rol **operador** (desde el admin o la página Usuarios):
   usuario `agente_esp32`. Los tickets automáticos saldrán "creados por agente_esp32".
2. Verifica que existan las estaciones y categorías (ej. "Fuga de gas", "Combustible").

## 2. Instalar y configurar el agente

```bash
cd esp32_agent
python -m venv venv
venv\Scripts\activate          # Windows  (Linux/Mac: source venv/bin/activate)
pip install -r requirements.txt

copy .env.example .env                         # y llena los valores
copy dispositivos.example.json dispositivos.json   # registra tus ESP32
```

- La IA es **gratis** con [Ollama](https://ollama.com): instálalo y corre `ollama pull qwen2.5:7b`.
  Si tu PC es lenta usa `qwen2.5:3b` (y cámbialo en `LLM_MODEL`). Con `IA_HABILITADA=false` funciona solo con reglas.
- En `dispositivos.json`, `estacion_id` es el id de la estación en Django.

## 3. Ejecutar

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

Docs interactivas: http://localhost:8001/docs

## 4. Probar sin hardware

```bash
python simulador.py --escenario fuga
```

Al pasar de 150 ppm se genera una alerta y aparece un ticket en PetroHelp.

## Endpoints

| Método | Ruta | Auth | Uso |
|---|---|---|---|
| POST | `/api/lecturas` | `X-Device-Id` + `X-Device-Key` | ESP32 envía lecturas |
| GET | `/api/dispositivos` | `Authorization: Token <django>` (admins) | Estado de dispositivos |
| GET | `/api/dispositivos/{id}/lecturas` | admins | Histórico |
| GET | `/api/alertas` | admins | Alertas y tickets generados |
| GET | `/health` | — | Salud del servicio |

## Umbrales por defecto

| Sensor | Media | Alta |
|---|---|---|
| gas_ppm | ≥ 150 | ≥ 300 |
| temperatura | ≥ 40 °C | ≥ 50 °C |
| nivel_tanque | ≤ 20 % | ≤ 10 % |

Se pueden cambiar por dispositivo con `"umbrales"` en `dispositivos.json`.
El agente no repite un ticket del mismo sensor durante `COOLDOWN_MINUTOS` (30 por defecto).
Una fuga de gas de severidad alta siempre crea un ticket de prioridad alta, aunque la IA opine otra cosa.

## Chatbot (PetroBot)

`POST /api/chat` con el token de Django. Consulta sensores, alertas y tickets, y crea tickets.
Respeta los permisos de cada rol porque usa el token del usuario que chatea.
