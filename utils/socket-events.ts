export default (socket: any) => {
  socket.on('joinRoom', (data: any) => {
    socket.join(data);
    console.log(`${data} joined the room`);
  });
};
