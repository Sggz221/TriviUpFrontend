# Etapa 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Copiar archivos de configuración de npm
COPY package.json package-lock.json* ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Build de la aplicación Angular
RUN npm run build

# Etapa 2: Servir con Caddy
# Servidor estático puro: el frontend ya no proxea al backend (llama directo
# a su dominio público en Railway), así que no depende de resolución DNS
# interna ni de configuración de upstream.
FROM caddy:2-alpine AS runtime

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist/TriviUp/browser /srv

EXPOSE 80
