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

# Etapa 2: Servir con nginx
FROM nginx:alpine AS runtime

# Instalar envsubst para substituir variables de entorno
RUN apk add --no-cache gettext

# Copiar template de configuración de nginx
COPY nginx.conf.template /etc/nginx/conf.d/default.conf.template

# Copiar archivos estáticos del build de Angular
COPY --from=build /app/dist/TriviUp/browser /usr/share/nginx/html

# Exponer puerto 80
EXPOSE 80

# Generar configuración final con variables de entorno y iniciar nginx
CMD envsubst < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'
