FROM node:22-alpine

WORKDIR /app

# Copy shared env loader
COPY services/shared/ ./services/shared/

# Copy API source and install deps
COPY tektonology-api/package.json tektonology-api/package-lock.json* ./tektonology-api/
RUN cd tektonology-api && npm install --omit=dev

COPY tektonology-api/ ./tektonology-api/

WORKDIR /app/tektonology-api

EXPOSE 3001

CMD ["node", "index.js"]
