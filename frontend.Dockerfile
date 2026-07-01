# ============================================================
# AAS PPR Modelling — Frontend (React + Vite)
# Build from repo root:  docker build -f frontend.Dockerfile -t aas-frontend ./ui
# ============================================================
FROM node:22-alpine

WORKDIR /app

# --- Dependencies ---
COPY package.json package-lock.json* ./
RUN npm install

# --- Source code ---
COPY . .

EXPOSE 5173

CMD ["npx", "vite", "--host", "0.0.0.0"]
