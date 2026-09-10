# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (better caching)
COPY package.json package-lock.json* yarn.lock* ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps
# Copy source
COPY . .

# Pass CRA env at build time (optional)
#   docker build --build-arg REACT_APP_DH_API=https://api.example.com ...
ARG REACT_APP_DH_API
ENV REACT_APP_DH_API=${REACT_APP_DH_API}

# Build CRA into static files
RUN NODE_OPTIONS="--max_old_space_size=4096" npm run build

# ---- runtime stage ----
FROM nginx:alpine
# Replace default server config
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
# Copy built static assets
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
