import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mi_secreto_super_seguro';

export function generateToken(payload: object): string{
    return jwt.sign(payload, JWT_SECRET, {expiresIn: '1h'});
}

export function verifyToken(token:string): any{
    return jwt.verify(token,JWT_SECRET);
}