import { Router } from "express";

import { register, login, getUsers } from '../controllers/user.controllers.js';
import { authenticateToken } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
// router.get('/usuarios', authenticateToken, getUsers);
router.get('/usuarios',  getUsers);

export default router;