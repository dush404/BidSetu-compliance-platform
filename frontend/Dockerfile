FROM node:20-bookworm-slim

WORKDIR /app

# Install OpenSSL required by Prisma engine on Debian/Ubuntu
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (ignoring optional lock mismatch warnings)
RUN npm install --no-audit --no-fund

COPY . .

# Generate Prisma Client for the Linux container architecture
RUN npx prisma generate

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "dev"]
