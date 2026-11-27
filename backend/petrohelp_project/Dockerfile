# Imagen del servidor de aplicaciones de PetroHelp (Django + Gunicorn).
# Se usa tanto en docker-compose como en cualquier nube que acepte contenedores.
FROM python:3.12-slim

# Salida sin buffer para que los logs aparezcan al instante, y sin .pyc
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencias del sistema: libpq para PostgreSQL y curl para el healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

# Las dependencias primero: si no cambian, Docker reutiliza esta capa.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Archivos estaticos del panel de administracion y de DRF.
RUN DJANGO_SECRET_KEY=build-only python manage.py collectstatic --no-input

# No corre como root: si alguien se mete al contenedor, no es administrador.
RUN useradd --create-home petrohelp && chown -R petrohelp:petrohelp /app
USER petrohelp

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fs http://localhost:8000/api/salud/ -o /dev/null || exit 1

# El entrypoint espera a la base, migra y arranca gunicorn.
COPY --chown=petrohelp:petrohelp entrypoint.sh /app/entrypoint.sh
ENTRYPOINT ["bash", "/app/entrypoint.sh"]
