# Imagen de la aplicacion web (React) servida por nginx.
# Etapa 1: compila. Etapa 2: solo los archivos ya compilados, sin Node.
FROM node:22-alpine AS compilacion
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# La direccion de la API se incrusta al compilar.
ARG VITE_API_URL=/api
ARG VITE_AGENT_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AGENT_URL=$VITE_AGENT_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=compilacion /app/dist /usr/share/nginx/html
COPY nginx.web.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
