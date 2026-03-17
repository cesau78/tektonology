FROM node:22-alpine

WORKDIR /app

# Copy shared env loader
COPY services/shared/ ./services/shared/

# Copy API source and install deps
COPY api/package.json api/package-lock.json* ./api/
RUN cd api && npm install --omit=dev

COPY api/ ./api/

WORKDIR /app/api

EXPOSE 3001

CMD ["node", "index.js"]
