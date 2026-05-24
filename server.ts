import http from 'http';
import https from 'https';
import fs from 'fs';
import app from './app';
import './config/database';
import { registerScrapeCron } from './src/scheduler/scrape.cron';
import { colorizeText } from './utils/others';

// Define PORT and environment variables
const PORT = process.env.PORT || 6000;
const isStaging = process.env.NODE_ENV === 'staging';

// Create HTTP or HTTPS server based on the environment
const server = isStaging
  ? https.createServer(
      {
        key: fs.readFileSync('/home/jenkins/SSL/ss.key'),
        cert: fs.readFileSync('/home/jenkins/SSL/ss.crt'),
      },
      app,
    )
  : http.createServer(app);

// Optionally set up WebSocket
// import setupSocket from "./utils/setupSocket";
// setupSocket(server);

// Start the server and log status
server.listen(PORT, () => {
  console.log(colorizeText(`Server Running on ${isStaging ? 'HTTPS' : 'HTTP'} on Port ${PORT}`, 'green', true));
  registerScrapeCron();
});
