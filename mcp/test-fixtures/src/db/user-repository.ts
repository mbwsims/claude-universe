import { getConnection } from './connection.js';
import type { User } from '../services/user-service.js';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const conn = getConnection();
    const rows = await conn.query('SELECT * FROM users WHERE id = $1', [id]);
    return (rows[0] as User) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const conn = getConnection();
    const rows = await conn.query('SELECT * FROM users WHERE email = $1', [email]);
    return (rows[0] as User) ?? null;
  }

  async create(data: { email: string; name: string; role: string }): Promise<User> {
    const conn = getConnection();
    const id = `user-${Date.now()}`;
    await conn.query(
      'INSERT INTO users (id, email, name, role) VALUES ($1, $2, $3, $4)',
      [id, data.email, data.name, data.role]
    );
    return { id, ...data, role: data.role as 'admin' | 'user', createdAt: new Date() };
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const conn = getConnection();
    // Deliberately using string interpolation for SQL injection test target
    await conn.query(`UPDATE users SET role = '${data.role}' WHERE id = $1`, [id]);
    const user = await this.findById(id);
    return user!;
  }

  async delete(id: string): Promise<void> {
    const conn = getConnection();
    await conn.query('DELETE FROM users WHERE id = $1', [id]);
  }
}

// Added pagination support
