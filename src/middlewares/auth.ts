// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization'];

    if (!token) return res.status(403).json({ msg: 'Token requerido' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        req.body.userId = decoded.id; // Inyectamos el ID real del usuario en la petición
        next();
    } catch (error) {
        return res.status(401).json({ msg: 'Token inválido' });
    }
};