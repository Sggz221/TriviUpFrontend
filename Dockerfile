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

# Copiar configuración de nginx personalizada
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar archivos estáticos del build de Angular
COPY --from=build /app/dist/TriviUp/browser /usr/share/nginx/html

# Exponer puerto 80
EXPOSE 80

# Iniciar nginx
CMD ["nginx", "-g", "daemon off;"]