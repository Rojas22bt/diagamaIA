import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import  { hashPassword, comparePassword } from '../services/auth.service.js';
import { generateToken } from '../services/jwt.service.js';

const prisma = new PrismaClient();

export const register = async ( req : Request, res: Response) =>{
    console.log(req.body);
    const { correo, contrasena, nombre } = req.body;
    try {
        const hashed = await hashPassword(contrasena);
        const user = await prisma.usuario.create({
            data: { correo, contrasena: hashed , nombre },
        });
        const token = generateToken({ id: user.id_usuario, correo: user.correo });
        res.json({ token, usuario: { id: user.id_usuario, correo: user.correo, nombre: user.nombre } });
    } catch (error: unknown) {
        if (error instanceof Error) {
            return res.status(500).json({ error: "Correo ya en uso" });
        }
        return res.status(500).json({ error: 'Error al registrar usuario' });
    }
}

export const login = async ( req : Request, res: Response ) =>{
    const { correo, contrasena } = req.body;
    const user = await prisma.usuario.findUnique({
      where: { correo },
    });
    if(!user){
        return res.status(401).json({ error: 'Usuario no existe' });
    }
    const valid = await comparePassword(contrasena, user.contrasena);
    if(!valid){
        return res.status(401).json({ error: 'Contraseña inválida' });
    }
    const token = generateToken({ id: user.id_usuario, correo: user.correo });
    res.json({ token, usuario: { id: user.id_usuario, correo: user.correo, nombre: user.nombre } });
 }


export const getUsers = async (req: Request, res: Response) => {
    try {
        const users = await prisma.usuario.findMany({
            select: { id_usuario: true, correo: true }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};


