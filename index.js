import * as dotenv from 'dotenv';

import { getPublicKey } from 'nostr-tools';
import express from 'express';
import morgan from 'morgan';
import WebSocket from 'ws';
import cors from 'cors';

import ConnectDB from './database/functions/Connect.js';
import HandleEvent from './listener/HandleEvent.js';
import Listener from './listener/index.js';
import Routes from './routes/index.js';


export const start = async () => {

  dotenv.config();

  global.WebSocket = WebSocket;

  const PORT = process.env.PORT || 5050;
  const app = express();

  // Enable request logging
  app.use(morgan('tiny'));

  // Enable any client to connect
  app.use(cors());

  // Serve onboarding page at root
  app.use('/', express.static('static'))

  // Attach api routes
  app.use('/', Routes());

  // Connect to the database
  await ConnectDB({ connection: process.env.DB_CONNECTION_STRING });

  // Listen for http connections
  app.listen(PORT, () => {

    console.log(`Listening on port ${PORT}`);

    // Create nostr interface
    app.listener = new Listener(app);

    // Set app's public key
    app.pubkey = getPublicKey(process.env.APP_SECRET_KEY);

    // Attach event handling logic
    app.listener.on('event', HandleEvent);

    // Listen for zap receipts
    app.listener.createPool('zap_receipts', [{
      kinds: [ 9735 ],
      '#p': [ app.pubkey ]
    }]);

    // Connect to relays
    for (let url of process.env.LISTENER_RELAYS.split(',')) {
      app.listener.connect(url);
    }

  });
};
