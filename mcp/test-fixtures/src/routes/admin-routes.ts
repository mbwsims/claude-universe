interface Request {
  headers: Record<string, string>;
  params: Record<string, string>;
  body: unknown;
}

interface Response {
  status(code: number): Response;
  json(data: unknown): void;
}

// No auth middleware at all — shieldkit should flag this entire file
export function registerAdminRoutes(app: { get: Function; post: Function; delete: Function }) {
  app.get('/admin/users', async (req: Request, res: Response) => {
    // Missing auth check
    res.json({ users: [] });
  });

  app.delete('/admin/users/:id', async (req: Request, res: Response) => {
    // Missing auth check
    res.json({ deleted: true });
  });
}
