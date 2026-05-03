import http from 'http';
import { Server as socketIOServer } from 'socket.io';
import { colorizeText } from './others';

function setupSocket(server: http.Server) {
  const io = new socketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', socket => {
    console.log(colorizeText('..........A user connected Successfully............ :', 'yellow'));

    // Handle all the events
    require('./socket-events')(socket);

    socket.on('sampletesting', data => {
      console.log(colorizeText('data added successfully', data));
      io.sockets.emit('gettingTesting', data);
      console.log(colorizeText('data retrieved successfully', data));
    });

    socket.on('disconnect', () => {
      console.log(colorizeText('..........A user disconnected............ :', 'blue'));
    });
  });
}

export default setupSocket;
