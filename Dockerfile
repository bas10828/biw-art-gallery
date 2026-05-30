FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# override standalone server.js with our custom Socket.io server
COPY --from=builder /app/server.js ./server.js
# install socket.io into standalone node_modules
RUN echo '{"name":"app","private":true}' > /tmp/pkg.json && \
    npm install --prefix /app socket.io nanoid --no-package-lock --no-save 2>/dev/null

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
