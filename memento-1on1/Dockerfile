# Build stage
FROM node:22-alpine AS builder

# Build arguments for Next.js public environment variables
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Set environment variables for build
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NODE_ENV=production

# Set working directory
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Copy workspace package file
COPY memento-1on1/package.json ./memento-1on1/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build -w memento-1on1

# Production stage
FROM node:22-alpine AS runner

# Set working directory
WORKDIR /app

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build from builder stage
# With monorepo, standalone output keeps the directory structure
COPY --from=builder --chown=nextjs:nodejs /app/memento-1on1/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/memento-1on1/.next/static ./memento-1on1/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/memento-1on1/public ./memento-1on1/public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "memento-1on1/server.js"]