import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { canReadProject, validation } from '../validation/service.js';

export async function getValidation(req: Request, res: Response): Promise<void> {
  const projectId = Number(req.params.id);
  const userId = (req as Request & { user: { id: number } }).user.id;
  if (!Number.isSafeInteger(projectId) || projectId <= 0) { res.status(400).json({ error: 'Proyecto inválido.' }); return; }
  try {
    if (!await canReadProject(projectId, userId)) { res.status(403).json({ error: 'No tienes permiso para consultar este proyecto.' }); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.json(await validation.current(projectId, userId));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      res.status(503).json({ error: 'Faltan las tablas de validación. Aplica las migraciones pendientes del backend y vuelve a abrir el panel.' });
      return;
    }
    res.status(422).json({ error: 'No se pudo revisar el diagrama. Comprueba la conexión, el formato guardado y los límites de revisión.' });
  }
}
