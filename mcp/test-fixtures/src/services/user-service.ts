import { UserRepository } from '../db/user-repository.js';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: Date;
}

export class UserService {
  constructor(private repo: UserRepository) {}

  async getUser(id: string): Promise<User | null> {
    return this.repo.findById(id);
  }

  async createUser(email: string, name: string): Promise<User> {
    const existing = await this.repo.findByEmail(email);
    if (existing) {
      throw new Error(`User with email ${email} already exists`);
    }
    return this.repo.create({ email, name, role: 'user' });
  }

  async updateRole(id: string, role: 'admin' | 'user'): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new Error('User not found');
    return this.repo.update(id, { role });
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.repo.findById(id);
    if (!user) throw new Error('User not found');
    await this.repo.delete(id);
  }
}
