import { createServer } from 'http';
import app from "./app.js";
import { initializeSocketIO } from './services/socket.service.js';

const PORT = process.env.PORT || 3000;

// Crear servidor HTTP
const httpServer = createServer(app);

// Inicializar Socket.IO
const io = initializeSocketIO(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  console.log(`Socket.IO configurado correctamente`);
});