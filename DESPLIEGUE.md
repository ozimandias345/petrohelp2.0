# PetroHelp — Contenedores, balanceo de cargas y dominio

Guía de la infraestructura de despliegue. Acompaña al documento de la
Etapa 4.

## 1. Arquitectura en contenedores

```
                    Internet
                       |
              [ nginx :8080 ]          balanceador de cargas
                /          \
        [ api1:8000 ]  [ api2:8000 ]   servidor de aplicaciones (x2)
                \          /
                 [ db:5432 ]           servidor de base de datos
                       |
                 volumen persistente
```

| Contenedor | Imagen | Papel |
|---|---|---|
| `petrohelp-balanceador` | nginx 1.27 | Recibe todo el tráfico y lo reparte |
| `petrohelp-api1` | Construida del proyecto | Servidor de aplicaciones, réplica 1 |
| `petrohelp-api2` | Construida del proyecto | Servidor de aplicaciones, réplica 2 |
| `petrohelp-web` | nginx con React compilado | Aplicación web |
| `petrohelp-db` | postgres 16 | Base de datos, con volumen persistente |

## 2. Levantarlo

```bash
cp .env.docker.example .env     # y llena las contraseñas
docker compose up --build
```

Queda en **http://localhost:8080**

Comandos útiles:

```bash
docker compose ps                    # estado de los contenedores
docker compose logs -f api1 api2     # ver cómo se reparte el trabajo
docker compose down                  # apagar
docker compose down -v               # apagar y borrar la base
```

## 3. Comprobar el balanceo de cargas

El endpoint `/api/salud/` dice qué réplica respondió. Pídelo varias veces:

```bash
for i in 1 2 3 4 5 6; do curl -s http://localhost:8080/api/salud/; echo; done
```

La respuesta alterna entre las dos réplicas:

```json
{"ok":true,"replica":"api1","host":"...","hora":"..."}
{"ok":true,"replica":"api2","host":"...","hora":"..."}
```

Prueba de tolerancia a fallos: apaga una réplica y el sistema sigue
respondiendo con la otra.

```bash
docker compose stop api2
curl -s http://localhost:8080/api/salud/     # sigue contestando, ahora api1
docker compose start api2
```

El balanceador usa `least_conn`: manda cada petición a la réplica con
menos conexiones abiertas, lo que reparte mejor que el turno redondo
cuando una petición tarda más que otra, por ejemplo al generar un
reporte en PDF.

## 4. Despliegue en la nube

El sistema está publicado en **Render**:

| Componente | Servicio | Dirección |
|---|---|---|
| Servidor de aplicaciones | `petrohelp-api` (Web Service) | https://petrohelp-api.onrender.com |
| Servidor de base de datos | `petrohelp-db` (PostgreSQL administrado) | Interna del servicio |
| Aplicación web | `petrohelp-web` (Static Site) | https://petrohelp-web.onrender.com |

El despliegue se define en `render.yaml` y se dispara solo con cada
cambio subido a la rama `main` de GitHub.

## 5. Dominio y certificados

Render entrega HTTPS automático con certificados de Let's Encrypt, que
se renuevan solos. Para usar un dominio propio:

1. En Render: servicio → **Settings → Custom Domains → Add**
2. Se registra el dominio y Render indica el registro **CNAME** a crear
3. En el proveedor del dominio se agrega ese CNAME
4. Render verifica y emite el certificado, normalmente en pocos minutos

## 6. Pruebas de liberación

Están documentadas en `Etapa_4_Pruebas_PetroHelp`: navegadores y SSL,
multidispositivo, pruebas funcionales automatizadas, respaldos, DLP y
DRP, y el video del flujo completo.

Repositorio: https://github.com/ozimandias345/petrohelp2.0
