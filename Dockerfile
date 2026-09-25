FROM node:22-slim
WORKDIR /app

COPY package*.json ./
COPY server.js server.ts ./
COPY public/ ./public/
COPY scripts/ ./scripts/
COPY src/ ./src/
COPY metadata.json ./

RUN mkdir -p .data .build-outputs dist build/web && node scripts/build.js

ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV NODE_OPTIONS="--experimental-strip-types"
EXPOSE 8080

CMD ["node", "server.js"]

