# Production image with no native Node addons (avoids Railway segfaults from bcrypt / better-sqlite3).
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional

COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "server/index.js"]
