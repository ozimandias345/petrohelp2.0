# PetroHelp — Frontend (React)

Interfaz web para el sistema de gestion de incidencias PetroHelp.
Consume la API de Django REST Framework que ya tienes corriendo.

## Requisitos

- Node.js instalado (https://nodejs.org, version 18 o superior)
- Tu backend de Django corriendo en http://127.0.0.1:8000

## Instalacion

1. Abre esta carpeta (petrohelp_frontend) en VS Code.
2. Abre la terminal integrada (Ctrl + ñ).
3. Instala las dependencias:
   npm install
4. Corre el proyecto:
   npm run dev
5. Abre en tu navegador la URL que te muestre la terminal, normalmente:
   http://localhost:5173

## Antes de usarlo

Asegurate de que, en OTRA terminal, tengas corriendo:
- Docker con tu contenedor dbpetro: docker start dbpetro
- Tu backend de Django: python manage.py runserver

Y que el backend tenga instalado django-cors-headers (viene en el
paquete de actualizacion backend_frontend_update.zip que te compartí
junto con este frontend).

## Usuarios de prueba

Puedes entrar con cualquiera de los usuarios que ya creaste en el admin
de Django, por ejemplo:

- operador1 - ve solo los tickets que el mismo creo
- admin_sistemas - ve solo los tickets de su departamento
- tu superusuario (German o el que hayas creado) - ve todo y accede
  al Dashboard

## Estructura del proyecto

src/
├── api/client.js           -> conexion con la API (URL base + token)
├── context/AuthContext.jsx -> maneja el login y la sesion
├── components/
│   ├── Layout.jsx           -> barra lateral + navegacion
│   └── Badges.jsx           -> etiquetas de estado/prioridad/rol
└── pages/
    ├── Login.jsx
    ├── TicketList.jsx       -> lista de tickets (filtrada por tu rol)
    ├── TicketDetail.jsx     -> detalle, comentarios, cambiar estado
    ├── CreateTicket.jsx     -> formulario para crear un ticket
    └── AdminDashboard.jsx   -> graficas (solo admins)

## Si necesitas cambiar la URL del backend

Edita la constante API_BASE_URL en src/api/client.js.
