import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { verifyToken } from './jwt.service.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthenticatedSocket extends Socket {
    userId?: number;
    projectId?: number;
    userEmail?: string;
    userName?: string;
}

export const initializeSocketIO = (httpServer: HTTPServer) => {
    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            credentials: true
        },
        transports: ['websocket', 'polling'],
        allowEIO3: true
    });

    // Middleware de autenticación para Socket.IO
    io.use(async (socket: any, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Token de autenticación requerido'));
            }

            // Usar el mismo verificador del servicio JWT para mantener el secreto consistente
            const decoded = verifyToken(token) as any;
            socket.userId = decoded.id;
            // Cargar datos del usuario para adjuntar email/nombre a los eventos
            try {
                const usr = await prisma.usuario.findUnique({
                    where: { id_usuario: decoded.id },
                    select: { correo: true, nombre: true }
                });
                socket.userEmail = usr?.correo;
                socket.userName = usr?.nombre;
            } catch (err) {
                console.warn('No se pudo cargar datos de usuario para socket:', err);
            }
            next();
        } catch (error) {
            next(new Error('Token inválido'));
        }
    });

    io.on('connection', (socket: any) => {
        console.log(`Usuario ${socket.userId} conectado`);

        // Unirse a un proyecto (sala)
        socket.on('join-project', async (projectId: number) => {
            try {
                // Verificar que el usuario tenga acceso al proyecto (colaborador)
                const acceso = await prisma.detalle_Proyecto.findFirst({
                    where: {
                        id_usuario: socket.userId,
                        id_proyecto: projectId
                    }
                });

                if (!acceso) {
                    socket.emit('error', 'No tienes acceso a este proyecto');
                    return;
                }

                socket.projectId = projectId;
                socket.join(`project-${projectId}`);
                socket.emit('joined-project', projectId);
                
                // Notificar a otros usuarios en el proyecto
                socket.to(`project-${projectId}`).emit('user-joined', {
                    projectId,
                    userId: socket.userId,
                    email: socket.userEmail,
                    name: socket.userName,
                    message: 'Un usuario se ha unido al proyecto'
                });

                console.log(`Usuario ${socket.userId} se unió al proyecto ${projectId}`);
            } catch (error) {
                console.error('Error al unirse al proyecto:', error);
                socket.emit('error', 'Error al unirse al proyecto');
            }
        });

        // Abandonar proyecto
        socket.on('leave-project', (projectId: number) => {
            socket.leave(`project-${projectId}`);
            socket.projectId = undefined;
            
            // Notificar a otros usuarios
            socket.to(`project-${projectId}`).emit('user-left', {
                projectId,
                userId: socket.userId,
                email: socket.userEmail,
                name: socket.userName,
                message: 'Un usuario ha abandonado el proyecto'
            });

            console.log(`Usuario ${socket.userId} abandonó el proyecto ${projectId}`);
        });

        // Actualización en tiempo real del diagrama
        socket.on('diagram-update', async (data: any) => {
            try {
                const { projectId, diagramData, changeType, elementId } = data;

                // Verificar acceso al proyecto
                if (!socket.projectId || socket.projectId !== projectId) {
                    socket.emit('error', 'No estás conectado a este proyecto');
                    return;
                }

                // Verificar que el usuario sigue teniendo acceso al proyecto
                const acceso = await prisma.detalle_Proyecto.findFirst({
                    where: {
                        id_usuario: socket.userId,
                        id_proyecto: projectId
                    }
                });

                if (!acceso) {
                    socket.emit('error', 'No tienes acceso a este proyecto');
                    return;
                }

                // Actualizar diagrama en la base de datos (evitar sobreescribir con deltas de movimiento)
                if (changeType !== 'move' && changeType !== 'cursor' && diagramData) {
                    // Asegurar que los datos estén en formato string para la base de datos
                    const dataToSave = typeof diagramData === 'string' ? diagramData : JSON.stringify(diagramData);
                    
                    await prisma.proyecto.update({
                        where: { id_proyecto: projectId },
                        data: { 
                            diagrama_json: dataToSave
                        }
                    });
                    
                    console.log(`Diagrama guardado en BD para proyecto ${projectId}`);
                }

                // Registrar acción para auditoría
                if (acceso && changeType !== 'move' && changeType !== 'cursor') {
                    await prisma.acciones_Proyecto.create({
                        data: {
                            id_detalle: acceso.id_detalle,
                            accion: `actualizar_elemento_${changeType}`
                        }
                    });
                }

                // Preparar datos para broadcast (asegurar que se envíen como objeto)
                let broadcastData = diagramData;
                if (typeof diagramData === 'string') {
                    try {
                        broadcastData = JSON.parse(diagramData);
                    } catch (err) {
                        console.error('Error parsing diagram data for broadcast:', err);
                        broadcastData = diagramData; // Usar datos originales si hay error
                    }
                }

                // Broadcast a otros usuarios en el proyecto
                const updateData = {
                    projectId,
                    userId: socket.userId,
                    userEmail: socket.userEmail,
                    userName: socket.userName,
                    diagramData: broadcastData, // Enviar como objeto para que el frontend lo procese correctamente
                    changeType,
                    elementId,
                    timestamp: new Date().toISOString()
                };

                socket.to(`project-${projectId}`).emit('diagram-updated', updateData);

                console.log(`Diagrama actualizado en proyecto ${projectId} por usuario ${socket.userId}, tipo: ${changeType}`);
            } catch (error) {
                console.error('Error al actualizar diagrama:', error);
                socket.emit('error', 'Error al actualizar diagrama');
            }
        });

        // Cursor en tiempo real
        socket.on('cursor-move', (data: any) => {
            const { projectId, x, y } = data;
            
            if (socket.projectId === projectId) {
                socket.to(`project-${projectId}`).emit('cursor-moved', {
                    projectId,
                    userId: socket.userId,
                    x,
                    y
                });
            }
        });

        // Selección de elemento
        socket.on('element-select', (data: any) => {
            const { projectId, elementId, elementType } = data;
            
            if (socket.projectId === projectId) {
                socket.to(`project-${projectId}`).emit('element-selected', {
                    userId: socket.userId,
                    elementId,
                    elementType
                });
            }
        });

        // Desconexión
        socket.on('disconnect', () => {
            if (socket.projectId) {
                socket.to(`project-${socket.projectId}`).emit('user-left', {
                    projectId: socket.projectId,
                    userId: socket.userId,
                    email: socket.userEmail,
                    name: socket.userName,
                    message: 'Un usuario se ha desconectado'
                });
            }
            console.log(`Usuario ${socket.userId} desconectado`);
        });

        // Manejo de errores
        socket.on('error', (error: any) => {
            console.error(`Error en socket ${socket.userId}:`, error);
        });
    });

    return io;
};