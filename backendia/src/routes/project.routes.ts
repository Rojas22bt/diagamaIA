import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
    createProject,
    getUserProjects,
    getProject,
    updateProjectDiagram,
    deleteProject,
    removeCollaborator,
    updateCollaboratorRole
} from '../controllers/project.controllers.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Crear proyecto
router.post('/', createProject);

// Obtener proyectos del usuario
router.get('/', getUserProjects);

// Obtener proyecto específico
router.get('/:id', getProject);

// Actualizar diagrama del proyecto
router.put('/:id/diagram', updateProjectDiagram);

// Eliminar proyecto
router.delete('/:id', deleteProject);

// Remover colaborador
router.delete('/:projectId/collaborators/:userId', removeCollaborator);

// Actualizar rol de colaborador (solo creador)
router.put('/:projectId/collaborators/:userId/role', updateCollaboratorRole);

export default router;