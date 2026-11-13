# PetroHelp 2.0

**Prevenimos antes de que pase.** Sistema de gestión preventiva de incidencias para gasolineras, con monitoreo IoT (ESP32), alertas automáticas con IA, chatbot, mapa de estaciones y reportes PDF/Excel para auditorías (SASISOPA).

## Estructura

```
backend/
  petrohelp_project/   API REST con Django + Django REST Framework + PostgreSQL
  esp32_agent/         Agente FastAPI: recibe lecturas de los ESP32, detecta anomalías,
                       crea tickets con IA (Ollama, local y gratis) y atiende el chatbot
  esp32_firmware/      Firmware Arduino para el ESP32 (gas, temperatura, nivel de tanque)
frontend/              Aplicación web con React + Vite + Tailwind CSS
```

## Puesta en marcha (desarrollo)

Se usan 3 terminales, una para cada servicio.

### 1. Backend Django (puerto 8000)

```bash
cd backend/petrohelp_project
python -m venv venv
venv\Scripts\activate            # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env           # y llena tus datos de PostgreSQL
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

### 2. Agente ESP32 + IA (puerto 8001)

Requiere [Ollama](https://ollama.com) con el modelo `qwen2.5:7b` (`ollama pull qwen2.5:7b`).

```bash
cd backend/esp32_agent
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
copy dispositivos.example.json dispositivos.json
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### 3. Frontend (puerto 5173)

```bash
cd frontend
npm install
npm run dev
```

## Módulos

| Módulo | Descripción |
|---|---|
| Tickets | Registro, seguimiento, comentarios, evidencias e historial de incidencias |
| Roles | Operador, administrador de departamento y administrador global |
| Dispositivos IoT | Estado en tiempo real de los sensores ESP32 |
| Alertas automáticas | Las lecturas fuera de rango generan tickets clasificados por IA |
| PetroBot | Chatbot para consultar sensores y tickets, y reportar incidencias |
| Mapa | Ubicación y estado de todas las estaciones (Leaflet + OpenStreetMap) |
| Reportes | Bitácora de incidencias exportable a PDF y Excel |

## Seguridad

Los datos sensibles (contraseñas, llaves, Wi-Fi, llaves de dispositivos) van en archivos `.env`,
`dispositivos.json` y `config.h`, que **no** se suben al repositorio. Usa los archivos `*.example` como guía.
