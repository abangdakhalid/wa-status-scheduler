FROM node:20-slim

WORKDIR /app

# Install dependencies for canvas/image manipulation if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --only=production

COPY . .

EXPOSE 3000

ENV PORT=3000

CMD ["node", "server.js"]
