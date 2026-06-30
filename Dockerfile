# Use lightweight, official Node.js alpine image
FROM node:20-alpine

# Set node environment
ENV NODE_ENV=production
ENV PORT=3000

# Set work directory
WORKDIR /app

# Copy package descriptors
COPY package.json ./

# Copy other application files (no need for npm install as we have zero runtime dependencies)
COPY src/ ./src/
COPY public/ ./public/
COPY data/ ./data/

# Create a non-privileged user and group for runtime security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

# Use the non-privileged user
USER appuser

# Expose port
EXPOSE 3000

# Start server
CMD ["npm", "start"]
