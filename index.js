import * as dotenv from 'dotenv';

import express from 'express';
import morgan from 'morgan';
import cors from 'cors';

import Connect from './database/functions/Connect.js';
import BlossomRouter from './routers/blossom/index.js';


export const start = async () => {

  dotenv.config();

  const PORT = process.env.PORT || 5050;
  const app = express();

  // Enable request logging
  app.use(morgan('tiny'));

  // Enable any client to connect
  app.use(cors());

  // Attach routers
  app.use('/', BlossomRouter());

  // Connect to the database
  await Connect({ connection: process.env.DB_CONNECTION_STRING });

  // Listen for http connections
  app.listen(PORT, () => {

    console.log(`Listening on port ${PORT}`);
  });
};
