FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install

COPY src/ ./src/

RUN npm run build

# Production stage — non serve build/TypeScript qui
FROM node:20-slim

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

RUN npm install --omit=dev

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/index.js"]
