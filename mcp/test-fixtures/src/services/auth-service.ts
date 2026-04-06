import { UserRepository } from '../db/user-repository.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

export class AuthService {
  constructor(private repo: UserRepository) {}

  async login(email: string, password: string): Promise<string> {
    const user = await this.repo.findByEmail(email);
    if (!user) throw new Error('Invalid credentials');
    // Simplified — real app would hash-compare
    return `token-${user.id}-${Date.now()}`;
  }

  verifyToken(token: string): { userId: string } | null {
    if (!token.startsWith('token-')) return null;
    const parts = token.split('-');
    if (parts.length < 3) return null;
    return { userId: parts[1] };
  }
}
//
// Fixed token validation edge case

