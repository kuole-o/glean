# ---- Stage 1: Build Frontend ----
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend
COPY frontend/package.json frontend/ ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Build Backend ----
FROM node:20-alpine AS backend-builder

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json ./
RUN npm install --production --no-optional 2>&1 | tail -5

# ---- Stage 3: Runtime ----
FROM node:20-alpine

RUN apk add --no-cache tzdata     && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime     && echo "Asia/Shanghai" > /etc/timezone

WORKDIR /app

COPY --from=backend-builder --chown=root:root /app/node_modules ./node_modules
COPY --chown=root:root src ./src
COPY --chown=root:root package.json ./

COPY --from=frontend-builder --chown=root:root /build/public ./public

EXPOSE 6689
CMD ["node", "src/index.js"]
