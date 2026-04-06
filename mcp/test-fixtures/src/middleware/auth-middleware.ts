interface Request {
  headers: Record<string, string>;
  user?: { userId: string };
}

interface Response {
  status(code: number): Response;
  json(data: unknown): void;
}

type NextFunction = () => void;

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  // Simplified verification
  if (token.startsWith('token-')) {
    req.user = { userId: token.split('-')[1] };
    next();
  } else {
    res.status(401).json({ error: 'Invalid token' });
  }
}
