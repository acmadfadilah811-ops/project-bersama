# --- Stage 1: Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Build project (generates dist folder)
RUN npm run build

# --- Stage 2: Serve ---
FROM nginx:stable-alpine

# Copy built static files to Nginx web root
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy dynamic Nginx configuration template
# Note: Nginx image automatically processes this using envsubst at startup
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Expose port (Cloud Run sets this dynamically, default to 8080)
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
