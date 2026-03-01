FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache wget
WORKDIR /app
COPY --from=builder /app/dist/ dist/
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/src/index.js"]
