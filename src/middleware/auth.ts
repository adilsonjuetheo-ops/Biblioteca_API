// middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'biblioteca_secret_key';

export type JwtPayload = {
  id: number;
  email: string;
  perfil: string;
};

// Extende o tipo Request para incluir o usuário autenticado
declare global {
  namespace Express {
    interface Request {
      usuarioAutenticado?: JwtPayload;
    }
  }
}

export function gerarToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function autenticar(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de autenticação não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.usuarioAutenticado = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

const PERFIS_ADMIN = ['bibliotecario', 'coordenacao'];

export function autenticarBibliotecario(req: Request, res: Response, next: NextFunction) {
  autenticar(req, res, () => {
    if (!PERFIS_ADMIN.includes(req.usuarioAutenticado?.perfil ?? '')) {
      return res.status(403).json({ erro: 'Acesso restrito ao bibliotecário' });
    }
    next();
  });
}