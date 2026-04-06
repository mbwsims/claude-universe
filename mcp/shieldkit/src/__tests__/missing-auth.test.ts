import { describe, it, expect } from 'vitest';
import { isRouteFile, analyzeAuth, analyzeHandlerAuth, buildMissingAuthResult } from '../analyzers/missing-auth.js';

describe('missing-auth', () => {
  describe('isRouteFile', () => {
    it('should match route.ts files', () => {
      expect(isRouteFile('app/api/users/route.ts')).toBe(true);
    });

    it('should match handler files', () => {
      expect(isRouteFile('src/handler.ts')).toBe(true);
    });

    it('should match controller files', () => {
      expect(isRouteFile('src/user.controller.ts')).toBe(true);
    });

    it('should match files in routes directory', () => {
      expect(isRouteFile('src/routes/users.ts')).toBe(true);
    });

    it('should match files in api directory', () => {
      expect(isRouteFile('src/api/users.ts')).toBe(true);
    });

    it('should NOT match utility files', () => {
      expect(isRouteFile('src/utils/helpers.ts')).toBe(false);
    });

    it('should match Python route files', () => {
      expect(isRouteFile('app/routes/users.py')).toBe(true);
    });

    it('should match Python files in api directory', () => {
      expect(isRouteFile('app/api/views.py')).toBe(true);
    });
  });

  describe('analyzeAuth (file-level)', () => {
    it('should detect getSession', () => {
      expect(analyzeAuth('const session = getSession(req);')).toBe(true);
    });

    it('should detect getServerSession', () => {
      expect(analyzeAuth('const session = await getServerSession();')).toBe(true);
    });

    it('should detect auth() call', () => {
      expect(analyzeAuth('const session = await auth();')).toBe(true);
    });

    it('should detect passport.authenticate', () => {
      expect(analyzeAuth('app.use(passport.authenticate("jwt"));')).toBe(true);
    });

    it('should detect jwt.verify', () => {
      expect(analyzeAuth('const decoded = jwt.verify(token, secret);')).toBe(true);
    });

    it('should detect Python @login_required', () => {
      expect(analyzeAuth('@login_required')).toBe(true);
    });

    it('should detect Python @permission_required', () => {
      expect(analyzeAuth('@permission_required("admin")')).toBe(true);
    });

    it('should return false when no auth patterns found', () => {
      expect(analyzeAuth('function getData() { return db.query("SELECT *"); }')).toBe(false);
    });
  });

  describe('analyzeHandlerAuth (handler-level)', () => {
    it('should detect auth in individual handlers', () => {
      const content = `
export async function GET(req) {
  const session = await getServerSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  return Response.json({ data: "ok" });
}

export async function POST(req) {
  // No auth check here!
  const body = await req.json();
  return Response.json({ created: true });
}
`;
      const result = analyzeHandlerAuth(content);
      expect(result).toHaveLength(2);

      const getHandler = result.find(h => h.name === 'GET');
      expect(getHandler?.hasAuth).toBe(true);

      const postHandler = result.find(h => h.name === 'POST');
      expect(postHandler?.hasAuth).toBe(false);
    });

    it('should detect auth in Express-style handlers', () => {
      const content = `
export function registerRoutes(app) {
  app.get('/users/:id', async (req, res) => {
    const token = req.headers['authorization'];
    const auth = verifyToken(token);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ user: {} });
  });

  app.post('/users', async (req, res) => {
    const { email } = req.body;
    res.json({ created: true });
  });
}
`;
      const result = analyzeHandlerAuth(content);
      // Should find at least the unprotected POST handler
      const unprotected = result.filter(h => !h.hasAuth);
      expect(unprotected.length).toBeGreaterThanOrEqual(1);
    });

    it('should require handler exports (isRouteFile guard)', () => {
      const content = `
// This is a utility file, not a route file -- no exports of handlers
function internalHelper() {
  return db.query("SELECT * FROM users");
}
`;
      const result = analyzeHandlerAuth(content);
      expect(result).toHaveLength(0);
    });

    it('should detect Python handler functions with missing decorators', () => {
      const content = `
@app.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()
    return jsonify(data), 201

@app.route("/users/<user_id>", methods=["GET"])
@login_required
def get_user(user_id):
    user = User.query.get(user_id)
    return jsonify(user)
`;
      const result = analyzeHandlerAuth(content);
      const unprotected = result.filter(h => !h.hasAuth);
      expect(unprotected.length).toBeGreaterThanOrEqual(1);
      expect(unprotected.some(h => h.name === 'create_user')).toBe(true);
    });
  });

  describe('buildMissingAuthResult', () => {
    it('should count unprotected files correctly', () => {
      const files = [
        { path: 'routes/a.ts', hasAuth: true },
        { path: 'routes/b.ts', hasAuth: false },
        { path: 'routes/c.ts', hasAuth: false },
      ];
      const result = buildMissingAuthResult(files);
      expect(result.total).toBe(3);
      expect(result.unprotected).toBe(2);
    });
  });

  describe('false-positive regression suite', () => {
    it('should NOT flag utility files as missing auth', () => {
      expect(isRouteFile('src/utils/helpers.ts')).toBe(false);
      expect(isRouteFile('src/lib/database.ts')).toBe(false);
      expect(isRouteFile('src/models/user.ts')).toBe(false);
    });

    it('should NOT flag files with auth patterns present', () => {
      const content = `
export async function GET(req) {
  const session = await getServerSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  return Response.json({ data: "ok" });
}
`;
      expect(analyzeAuth(content)).toBe(true);
    });

    it('should NOT flag middleware files as route files', () => {
      expect(isRouteFile('src/middleware/auth.ts')).toBe(false);
      expect(isRouteFile('src/middleware/logger.ts')).toBe(false);
    });
  });

  describe('middleware auth detection', () => {
    it('should detect Express app.use with auth middleware', () => {
      const content = `
app.use(authMiddleware);
app.use(cors());

app.get('/users', (req, res) => {
  res.json([]);
});
`;
      expect(analyzeAuth(content)).toBe(true);
    });

    it('should detect passport.initialize as middleware', () => {
      const content = `
app.use(passport.initialize());
app.use(passport.session());
`;
      expect(analyzeAuth(content)).toBe(true);
    });

    it('should detect router.use with requireAuth', () => {
      const content = `
router.use(requireAuth);

router.get('/profile', (req, res) => {
  res.json(req.user);
});
`;
      expect(analyzeAuth(content)).toBe(true);
    });

    it('should detect Django middleware in settings pattern', () => {
      const content = `
MIDDLEWARE = [
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'myapp.middleware.LoginRequiredMiddleware',
]
`;
      expect(analyzeAuth(content)).toBe(true);
    });
  });
});
