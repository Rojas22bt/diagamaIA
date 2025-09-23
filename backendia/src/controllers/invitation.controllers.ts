import type { Request, Response } from 'express';
import  { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Enviar invitación a colaborar en un proyecto
export const sendInvitation = async (req: Request, res: Response) => {
    try {
        const { id_proyecto, correo_destinatario, id_permiso } = req.body;
        const userId = (req as any).user.id;

        // Verificar que el usuario sea creador del proyecto
        const acceso = await prisma.detalle_Proyecto.findFirst({
            where: {
                id_usuario: userId,
                id_proyecto: parseInt(id_proyecto)
            },
            include: { Permisos: true }
        });

        if (!acceso || acceso.Permisos.descripcion !== 'creador') {
            return res.status(403).json({ error: 'Solo el creador puede enviar invitaciones' });
        }

        // Buscar usuario destinatario
        const destinatario = await prisma.usuario.findUnique({
            where: { correo: correo_destinatario }
        });

        if (!destinatario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Evitar invitarse a sí mismo
        if (destinatario.id_usuario === userId) {
            return res.status(400).json({ error: 'No puedes invitarte a ti mismo' });
        }

        const proyectoIdNum = parseInt(id_proyecto);
        const permisoIdNum = parseInt(id_permiso);

        // Verificar si ya es colaborador del proyecto
        const yaColaborador = await prisma.detalle_Proyecto.findFirst({
            where: {
                id_usuario: destinatario.id_usuario,
                id_proyecto: proyectoIdNum
            }
        });
        if (yaColaborador) {
            return res.status(409).json({ error: 'El usuario ya es colaborador de este proyecto', code: 'ALREADY_COLLABORATOR' });
        }

        // Verificar si ya existe una invitación (por la restricción única)
        const invitacionExistente = await prisma.invitacion.findFirst({
            where: {
                id_proyecto: proyectoIdNum,
                id_destinatario: destinatario.id_usuario
            }
        });

        if (invitacionExistente) {
            if (invitacionExistente.estado === 'pendiente') {
                return res.status(409).json({ error: 'Ya existe una invitación pendiente para este usuario' });
            }
            if (invitacionExistente.estado === 'aceptada') {
                // Si ya no es colaborador (porque fue removido), podemos reabrir la invitación
                if (!yaColaborador) {
                    const invitacionActualizada = await prisma.invitacion.update({
                        where: { id_invitacion: invitacionExistente.id_invitacion },
                        data: {
                            id_remitente: userId,
                            id_permiso: permisoIdNum,
                            estado: 'pendiente',
                            fecha_respuesta: null
                        }
                    });
                    return res.status(200).json({
                        success: true,
                        invitacion: invitacionActualizada,
                        mensaje: 'Invitación reenviada correctamente'
                    });
                }
                // Si sigue siendo colaborador, bloquear
                return res.status(409).json({ error: 'El usuario ya es colaborador de este proyecto' });
            }
            // Si fue rechazada u otro estado, reenviar actualizando la existente
            const invitacionActualizada = await prisma.invitacion.update({
                where: { id_invitacion: invitacionExistente.id_invitacion },
                data: {
                    id_remitente: userId,
                    id_permiso: permisoIdNum,
                    estado: 'pendiente',
                    fecha_respuesta: null
                }
            });

            return res.status(200).json({
                success: true,
                invitacion: invitacionActualizada,
                mensaje: 'Invitación reenviada correctamente'
            });
        }

        // Crear invitación
        const invitacion = await prisma.invitacion.create({
            data: {
                id_proyecto: proyectoIdNum,
                id_remitente: userId,
                id_destinatario: destinatario.id_usuario,
                id_permiso: permisoIdNum,
                estado: 'pendiente'
            }
        });

        res.status(201).json({
            success: true,
            invitacion,
            mensaje: 'Invitación enviada correctamente'
        });
    } catch (error) {
        console.error('Error al enviar invitación:', error);
        // Si llega aquí, devolver mensaje genérico
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Obtener invitaciones recibidas
export const getReceivedInvitations = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const invitaciones = await prisma.invitacion.findMany({
            where: {
                id_destinatario: userId,
                estado: 'pendiente'
            },
            include: {
                Proyecto: true,
                Remitente: {
                    select: { nombre: true, correo: true }
                }
            }
        });

        res.json({
            success: true,
            invitaciones
        });
    } catch (error) {
        console.error('Error al obtener invitaciones:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Responder a una invitación (aceptar/rechazar)
export const respondToInvitation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { respuesta } = req.body;
        const userId = (req as any).user.id;

        if (!id) {
            return res.status(400).json({ error: 'ID de invitación requerido' });
        }

        const invitacion = await prisma.invitacion.findUnique({
            where: { id_invitacion: parseInt(id) }
        });

        if (!invitacion) {
            return res.status(404).json({ error: 'Invitación no encontrada' });
        }

        if (invitacion.id_destinatario !== userId) {
            return res.status(403).json({ error: 'No tienes permiso para responder a esta invitación' });
        }

        const invitacionActualizada = await prisma.invitacion.update({
            where: { id_invitacion: parseInt(id) },
            data: {
                estado: respuesta,
                fecha_respuesta: new Date()
            }
        });

        if (respuesta === 'aceptada') {
            await prisma.detalle_Proyecto.create({
                data: {
                    id_usuario: userId,
                    id_proyecto: invitacion.id_proyecto,
                    id_permiso: invitacion.id_permiso
                }
            });
        }

        res.json({
            success: true,
            invitacion: invitacionActualizada,
            mensaje: `Invitación ${respuesta} correctamente`
        });
    } catch (error) {
        console.error('Error al responder invitación:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Obtener permisos disponibles
export const getPermissions = async (req: Request, res: Response) => {
    try {
        const permisos = await prisma.permisos.findMany({
            where: {
                descripcion: {
                    not: 'creador'
                }
            }
        });

        res.json({
            success: true,
            permisos
        });
    } catch (error) {
        console.error('Error al obtener permisos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Obtener invitaciones enviadas
export const getSentInvitations = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const invitaciones = await prisma.invitacion.findMany({
            where: {
                id_remitente: userId
            },
            include: {
                Proyecto: true,
                Destinatario: {
                    select: { nombre: true, correo: true }
                },
                Permiso: true
            }
        });

        res.json({
            success: true,
            invitaciones
        });
    } catch (error) {
        console.error('Error al obtener invitaciones enviadas:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Cancelar invitación (solo el remitente)
export const cancelInvitation = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        if (!id) {
            return res.status(400).json({ error: 'ID de invitación requerido' });
        }

        // Buscar invitación
        const invitacion = await prisma.invitacion.findUnique({
            where: { id_invitacion: parseInt(id) }
        });

        if (!invitacion) {
            return res.status(404).json({ error: 'Invitación no encontrada' });
        }

        // Verificar que sea el remitente
        if (invitacion.id_remitente !== userId) {
            return res.status(403).json({ error: 'Solo el remitente puede cancelar la invitación' });
        }

        // Verificar que esté pendiente
        if (invitacion.estado !== 'pendiente') {
            return res.status(400).json({ error: 'Solo se pueden cancelar invitaciones pendientes' });
        }

        // Eliminar invitación
        await prisma.invitacion.delete({
            where: { id_invitacion: parseInt(id) }
        });

        res.json({
            success: true,
            mensaje: 'Invitación cancelada correctamente'
        });
    } catch (error) {
        console.error('Error al cancelar invitación:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};


