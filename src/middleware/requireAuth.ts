import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/jwt';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const user = verifyToken(token);
    if (user) {
      req.user = user;
      req.bearerToken = token;
      next();
      return;
    }
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.isAuthenticated()) {
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized' });
}
