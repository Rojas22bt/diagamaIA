import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Crear un nuevo proyecto
export const createProject = async (req: Request, res: Response) => {
    try {
        const { name, titulo, description, diagrama_json, is_public } = req.body;
        const userId = (req as any).user.id; // Del middleware de autenticación

        // Usar 'name' o 'titulo' dependiendo de lo que venga del frontend
        const projectTitle = name || titulo;
        
        if (!projectTitle) {
            return res.status(400).json({ error: 'El título del proyecto es requerido' });
        }

        // Crear el proyecto
        const proyecto = await prisma.proyecto.create({
            data: {
                titulo: projectTitle,
                fecha_inicio: new Date(),
                diagrama_json: diagrama_json || null,
                estado: 'activo'
            }
        });

        // Asignar el rol de creador al usuario
        const permisoCreador = await prisma.permisos.findFirst({
            where: { descripcion: 'creador' }
        });

        if (!permisoCreador) {
            // Crear permisos si no existen
            const creador = await prisma.permisos.create({
                data: { descripcion: 'creador' }
            });
            
            await prisma.detalle_Proyecto.create({
                data: {
                    id_usuario: userId,
                    id_proyecto: proyecto.id_proyecto,
                    id_permiso: creador.id_permiso
                }
            });
        } else {
            await prisma.detalle_Proyecto.create({
                data: {
                    id_usuario: userId,
                    id_proyecto: proyecto.id_proyecto,
                    id_permiso: permisoCreador.id_permiso
                }
            });
        }

        // Registrar acción
        const detalle = await prisma.detalle_Proyecto.findFirst({
            where: {
                id_usuario: userId,
                id_proyecto: proyecto.id_proyecto
            }
        });

        if (detalle) {
            await prisma.acciones_Proyecto.create({
                data: {
                    id_detalle: detalle.id_detalle,
                    accion: 'crear_proyecto'
                }
            });
        }

        res.status(201).json({
            success: true,
            proyecto: {
                id: proyecto.id_proyecto,
                name: proyecto.titulo,
                description: null,
                diagrama_json: proyecto.diagrama_json,
                is_public: false,
                created_at: proyecto.fecha_inicio.toISOString(),
                updated_at: proyecto.fecha_inicio.toISOString(),
                creator_id: userId,
                estado: proyecto.estado,
                rol: 'creador'
            }
        });
    } catch (error) {
        console.error('Error al crear proyecto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Obtener proyectos del usuario
export const getUserProjects = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;

        const proyectos = await prisma.detalle_Proyecto.findMany({
            where: { id_usuario: userId },
            include: {
                Proyecto: true,
                Permisos: true,
                Usuario: {
                    select: { id_usuario: true, nombre: true, correo: true }
                }
            }
        });

        const proyectosFormateados = proyectos.map(detalle => ({
            id: detalle.Proyecto.id_proyecto,
            name: detalle.Proyecto.titulo,
            description: null, // Puedes agregar este campo en el futuro
            diagrama_json: detalle.Proyecto.diagrama_json,
            is_public: false, // Puedes agregar este campo en el futuro
            created_at: detalle.Proyecto.fecha_inicio.toISOString(),
            updated_at: detalle.Proyecto.fecha_inicio.toISOString(),
            creator_id: detalle.Usuario.id_usuario,
            estado: detalle.Proyecto.estado,
            rol: detalle.Permisos.descripcion,
            creator: {
                id: detalle.Usuario.id_usuario,
                name: detalle.Usuario.nombre,
                email: detalle.Usuario.correo
            }
        }));

        res.json({
            success: true,
            proyectos: proyectosFormateados
        });
    } catch (error) {
        console.error('Error al obtener proyectos:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Obtener un proyecto específico
export const getProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        if (!id) {
            return res.status(400).json({ error: 'ID de proyecto requerido' });
        }

        // Verificar que el usuario tenga acceso al proyecto
        const acceso = await prisma.detalle_Proyecto.findFirst({
            where: {
                id_usuario: userId,
                id_proyecto: parseInt(id)
            },
            include: {
                Proyecto: true,
                Permisos: true
            }
        });

        if (!acceso) {
            return res.status(403).json({ error: 'No tienes acceso a este proyecto' });
        }

        // Obtener colaboradores del proyecto
        const colaboradores = await prisma.detalle_Proyecto.findMany({
            where: { id_proyecto: parseInt(id) },
            include: {
                Usuario: {
                    select: { id_usuario: true, nombre: true, correo: true }
                },
                Permisos: true
            }
        });

        res.json({
            success: true,
            proyecto: {
                id: acceso.Proyecto.id_proyecto,
                name: acceso.Proyecto.titulo,
                description: null,
                diagrama_json: acceso.Proyecto.diagrama_json,
                is_public: false,
                created_at: acceso.Proyecto.fecha_inicio.toISOString(),
                updated_at: acceso.Proyecto.fecha_inicio.toISOString(),
                creator_id: acceso.id_usuario,
                estado: acceso.Proyecto.estado,
                rol: acceso.Permisos.descripcion,
                colaboradores: colaboradores.map(col => ({
                    usuario: {
                        id: col.Usuario.id_usuario,
                        name: col.Usuario.nombre,
                        email: col.Usuario.correo
                    },
                    rol: col.Permisos.descripcion
                }))
            }
        });
    } catch (error) {
        console.error('Error al obtener proyecto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Actualizar diagrama del proyecto
export const updateProjectDiagram = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { diagrama_json } = req.body;
        const userId = (req as any).user.id;

        if (!id) {
            return res.status(400).json({ error: 'ID de proyecto requerido' });
        }

        // Verificar acceso y permisos
        const acceso = await prisma.detalle_Proyecto.findFirst({
            where: {
                id_usuario: userId,
                id_proyecto: parseInt(id)
            },
            include: { Permisos: true }
        });

        if (!acceso) {
            return res.status(403).json({ error: 'No tienes acceso a este proyecto' });
        }

        // Actualizar el diagrama
        const proyecto = await prisma.proyecto.update({
            where: { id_proyecto: parseInt(id) },
            data: { diagrama_json }
        });

        // Registrar acción
        await prisma.acciones_Proyecto.create({
            data: {
                id_detalle: acceso.id_detalle,
                accion: 'actualizar_diagrama'
            }
        });

        res.json({
            success: true,
            proyecto,
            mensaje: 'Diagrama actualizado correctamente'
        });
    } catch (error) {
        console.error('Error al actualizar diagrama:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Eliminar proyecto (solo creador)
export const deleteProject = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        if (!id) {
            return res.status(400).json({ error: 'ID de proyecto requerido' });
        }

        // Verificar que el usuario sea el creador
        const acceso = await prisma.detalle_Proyecto.findFirst({
            where: {
                id_usuario: userId,
                id_proyecto: parseInt(id)
            },
            include: { Permisos: true }
        });

        if (!acceso || acceso.Permisos.descripcion !== 'creador') {
            return res.status(403).json({ error: 'Solo el creador puede eliminar el proyecto' });
        }

        // Eliminar proyecto (las relaciones se eliminan en cascada)
        await prisma.proyecto.delete({
            where: { id_proyecto: parseInt(id) }
        });

        res.json({
            success: true,
            mensaje: 'Proyecto eliminado correctamente'
        });
    } catch (error) {
        console.error('Error al eliminar proyecto:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Remover colaborador (solo creador)
export const removeCollaborator = async (req: Request, res: Response) => {
    try {
        const { projectId, userId: collaboratorId } = req.params;
        const userId = (req as any).user.id;

        if (!projectId || !collaboratorId) {
            return res.status(400).json({ error: 'ID de proyecto y usuario requeridos' });
        }

        // Verificar que el usuario sea el creador
        const acceso = await prisma.detalle_Proyecto.findFirst({
            where: {
                id_usuario: userId,
                id_proyecto: parseInt(projectId)
            },
            include: { Permisos: true }
        });

        if (!acceso || acceso.Permisos.descripcion !== 'creador') {
            return res.status(403).json({ error: 'Solo el creador puede remover colaboradores' });
        }

        // No permitir que el creador se remueva a sí mismo
        if (userId === parseInt(collaboratorId)) {
            return res.status(400).json({ error: 'El creador no puede removerse a sí mismo' });
        }

        // Remover colaborador del proyecto
        const detalleEliminado = await prisma.detalle_Proyecto.deleteMany({
            where: {
                id_usuario: parseInt(collaboratorId),
                id_proyecto: parseInt(projectId)
            }
        });

        if (detalleEliminado.count === 0) {
            return res.status(404).json({ error: 'Colaborador no encontrado en el proyecto' });
        }

        // Si existía una invitación previa aceptada, marcarla como 'rechazada' para permitir reenviar más adelante
        await prisma.invitacion.updateMany({
            where: {
                id_proyecto: parseInt(projectId),
                id_destinatario: parseInt(collaboratorId),
                estado: 'aceptada'
            },
            data: {
                estado: 'rechazada',
                fecha_respuesta: new Date()
            }
        });

        res.json({
            success: true,
            mensaje: 'Colaborador removido correctamente'
        });
    } catch (error) {
        console.error('Error al remover colaborador:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// Actualizar rol de colaborador (solo creador)
export const updateCollaboratorRole = async (req: Request, res: Response) => {
    try {
        const { projectId, userId: collaboratorId } = req.params;
        const { rol } = req.body as { rol?: string };
        const userId = (req as any).user.id;

        if (!projectId || !collaboratorId || !rol) {
            return res.status(400).json({ error: 'Proyecto, usuario y rol son requeridos' });
        }

        // Verificar que quien solicita sea el creador del proyecto
        const acceso = await prisma.detalle_Proyecto.findFirst({
            where: {
                id_usuario: userId,
                id_proyecto: parseInt(projectId)
            },
            include: { Permisos: true }
        });
        if (!acceso || acceso.Permisos.descripcion !== 'creador') {
            return res.status(403).json({ error: 'Solo el creador puede cambiar roles de colaboradores' });
        }

        // No permitir cambiar el rol del creador
        const collaboratorIdNum = parseInt(collaboratorId);
        if (collaboratorIdNum === userId) {
            return res.status(400).json({ error: 'No puedes cambiar tu propio rol de creador' });
        }

        // Mapear rol string -> id_permiso
        const rolNorm = String(rol).toLowerCase();
        let permiso = await prisma.permisos.findFirst({ where: { descripcion: rolNorm } });
        if (!permiso) {
            // Si no existe, crearlo (para ambientes donde no estén sembrados)
            permiso = await prisma.permisos.create({ data: { descripcion: rolNorm } });
        }

        // Verificar que el colaborador existe en el proyecto
        const detalle = await prisma.detalle_Proyecto.findFirst({
            where: { id_usuario: collaboratorIdNum, id_proyecto: parseInt(projectId) }
        });
        if (!detalle) {
            return res.status(404).json({ error: 'Colaborador no encontrado en el proyecto' });
        }

        // Actualizar rol
        await prisma.detalle_Proyecto.updateMany({
            where: { id_usuario: collaboratorIdNum, id_proyecto: parseInt(projectId) },
            data: { id_permiso: permiso.id_permiso }
        });

        res.json({ success: true, mensaje: 'Rol actualizado correctamente', rol: rolNorm });
    } catch (error) {
        console.error('Error al actualizar rol de colaborador:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};