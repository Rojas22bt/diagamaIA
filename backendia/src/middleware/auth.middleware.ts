import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwt.service.js';

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const user = verifyToken(token);
    // Agregar el usuario al request
    (req as any).user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido' });
  }
}
