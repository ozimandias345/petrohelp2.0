#!/usr/bin/env bash
# Arranque del contenedor: espera a PostgreSQL, aplica migraciones y
# levanta gunicorn. Se ejecuta en cada replica.
set -o errexit

echo "Esperando a la base de datos..."
python - <<'PY'
import os, time, socket, urllib.parse as up
url = os.environ.get("DATABASE_URL", "")
if url:
    p = up.urlparse(url)
    host, puerto = p.hostname, p.port or 5432
    for intento in range(60):
        try:
            with socket.create_connection((host, puerto), timeout=2):
                print(f"Base disponible en {host}:{puerto}")
                break
        except OSError:
            time.sleep(1)
    else:
        raise SystemExit("La base de datos no respondio a tiempo.")
PY

python manage.py migrate --no-input

# Solo la primera replica siembra los datos iniciales, para no duplicarlos.
if [ "${SEMBRAR_DATOS:-false}" = "true" ]; then
  python manage.py preparar_nube
fi

exec gunicorn petrohelp_backend.wsgi:application \
     --bind 0.0.0.0:8000 \
     --workers "${GUNICORN_WORKERS:-2}" \
     --timeout 60 \
     --access-logfile - \
     --error-logfile -
