# syntax=docker/dockerfile:1
FROM node:20.11

WORKDIR /app

ENV NODE_ENV=production
COPY ./package*.json .
RUN npm install

COPY . .

EXPOSE 5050

VOLUME [ "/data" ]
ENV DB_PATH="/data"
ENV STORAGE_RATE_USD="0.05"
ENV LISTENER_RELAYS="wss://relay.damus.io,wss://nos.lol,wss://relay.snort.social,wss://relay.nostrplebs.com,wss://relay.plebstr.com,wss://relay.nostr.band,wss://nostr.wine"

ENTRYPOINT [ "node", "loader.cjs" ]
