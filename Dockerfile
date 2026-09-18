# Production image with no native Node addons (avoids Railway segfaults from bcrypt / better-sqlite3).
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional

COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

# Must match Railway public networking target port (app reads process.env.PORT).
EXPOSE 8080

CMD ["node", "server/index.js"]
