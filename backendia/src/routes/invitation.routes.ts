import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import {
    sendInvitation,
    getReceivedInvitations,
    getSentInvitations,
    respondToInvitation,
    cancelInvitation,
    getPermissions
} from '../controllers/invitation.controllers.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Obtener permisos disponibles
router.get('/permissions', getPermissions);

// Enviar invitación
router.post('/', sendInvitation);

// Obtener invitaciones recibidas
router.get('/received', getReceivedInvitations);

// Obtener invitaciones enviadas
router.get('/sent', getSentInvitations);

// Responder a invitación
router.put('/:id/respond', respondToInvitation);

// Cancelar invitación
router.delete('/:id', cancelInvitation);

export default router;