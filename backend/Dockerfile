# Stage 1: Build backend TypeScript
FROM node:20-slim AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/tsconfig.json ./
RUN npm install
COPY backend/src/ ./src/
RUN npm run build

# Stage 2: Build frontend Next.js (static export)
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npx next build

# Stage 3: Production
FROM node:20-slim
WORKDIR /app

# Backend
COPY --from=backend-builder /app/backend/package*.json ./
COPY --from=backend-builder /app/backend/dist ./dist
RUN npm install --omit=dev

# Frontend static files (served da Express)
COPY --from=frontend-builder /app/frontend/out ./frontend/out

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/index.js"]
