FROM node:18-bullseye-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 8000

ENV PORT=8000
ENV NODE_ENV=production

CMD ["npm", "start"]
