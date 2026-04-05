import { Request, Response, NextFunction } from 'express';

/**
 * Middleware che valida il token JWT dalla query string o Authorization header.
 */
export function authMiddleware(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;
    const token = queryToken || authHeader?.replace('Bearer ', '');

    if (!token || token !== secret) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  };
}
