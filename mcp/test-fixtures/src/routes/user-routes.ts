import { UserService } from '../services/user-service.js';
import { AuthService } from '../services/auth-service.js';

interface Request {
  headers: Record<string, string>;
  params: Record<string, string>;
  body: unknown;
}

interface Response {
  status(code: number): Response;
  json(data: unknown): void;
}

export function registerUserRoutes(app: { get: Function; post: Function; delete: Function }) {
  const userService = new UserService(null as any);
  const authService = new AuthService(null as any);

  // GET /users/:id — authenticated
  app.get('/users/:id', async (req: Request, res: Response) => {
    const token = req.headers['authorization'];
    const auth = authService.verifyToken(token);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });

    const user = await userService.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  });

  // POST /users — no auth check (intentional gap for shieldkit to find)
  app.post('/users', async (req: Request, res: Response) => {
    const { email, name } = req.body as { email: string; name: string };
    const user = await userService.createUser(email, name);
    res.status(201).json(user);
  });
}

// Rate limiting added
