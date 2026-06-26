# Stage 1: Install dependencies and generate Prisma Client
FROM node:18-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package managers and Prisma schema
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund
RUN npx prisma generate

# Stage 2: Build the Next.js application
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the project
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN --mount=type=cache,target=/app/.next/cache npm run build

# Stage 3: Production server
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set correct permissions for the uploads directory
RUN mkdir -p /app/public/uploads && chown nextjs:nodejs /app/public/uploads

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# Ensure you have 'output: "standalone"' in your next.config.js!
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Create a startup script that runs db push then starts the server
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'npx prisma db push --accept-data-loss' >> /app/start.sh && \
    echo 'exec node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Start the server using the script
CMD ["/app/start.sh"]