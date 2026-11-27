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

# Solo una replica aplica las migraciones. Si las dos lo intentan a la
# vez sobre una base vacia, chocan al crear las mismas tablas y una de
# ellas revienta con un error de clave duplicada.
if [ "${EJECUTAR_MIGRACIONES:-true}" = "true" ]; then
  python manage.py migrate --no-input
else
  echo "Esperando a que la replica principal aplique las migraciones..."
  for intento in $(seq 1 90); do
    if python manage.py migrate --check >/dev/null 2>&1; then
      echo "Migraciones listas."
      break
    fi
    sleep 2
  done
fi

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
