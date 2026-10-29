# syntax=docker/dockerfile:1

# ---- build: compile the Angular app ----
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration production

# ---- run: nginx serves the static files and proxies /api to the gateway ----
FROM nginxinc/nginx-unprivileged:stable-alpine

# Where /api goes. In docker compose this is the gateway's service name.
ENV API_UPSTREAM=http://api-gateway:8080

COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/frontend-claims/browser /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
