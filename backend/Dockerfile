FROM node:20-bookworm-slim

WORKDIR /opt/app

# Install build dependencies if needed for native modules
RUN apt-get update && apt-get install -y build-essential python3 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN mkdir -p .tmp

EXPOSE 1337

CMD ["npm", "run", "develop"]
