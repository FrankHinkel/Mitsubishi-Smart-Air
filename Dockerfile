FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl iproute2 net-tools sqlite3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY app.js database.js device-api.js index.html server.js styles.css ./

RUN mkdir -p /data

ENV DATA_DIR=/data
ENV HOST=0.0.0.0
ENV PORT=13920

EXPOSE 13920

CMD ["node", "server.js"]
