@echo off
title PetroHelp - Agente y tunel
echo ======================================
echo  PetroHelp: agente IoT + tunel publico
echo ======================================
echo.
echo Se abriran dos ventanas. No las cierres mientras uses el sistema.
echo.

cd /d "%~dp0esp32_agent"
start "PetroHelp - Agente" cmd /k "venv\Scripts\activate && python -m uvicorn app.main:app --host 0.0.0.0 --port 8001"

timeout /t 6 >nul

start "PetroHelp - Tunel ngrok" cmd /k "ngrok http --domain=breana-unattainable-camren.ngrok-free.dev 8001"

echo.
echo Listo. El agente escucha en el puerto 8001 y el tunel lo publica en:
echo   https://breana-unattainable-camren.ngrok-free.dev
echo.
echo Recuerda tener corriendo tambien Ollama para que funcione el chatbot.
echo.
pause
