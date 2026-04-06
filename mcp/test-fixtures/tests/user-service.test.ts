import { describe, it, expect, vi } from 'vitest';
import { UserService } from '../src/services/user-service';

// Heavy mock setup — testkit should flag mock health
const mockRepo = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe('UserService', () => {
  const service = new UserService(mockRepo as any);

  it('gets a user', async () => {
    mockRepo.findById.mockResolvedValue({ id: '1', name: 'Alice' });
    const user = await service.getUser('1');
    expect(user).toBeDefined();  // shallow
    expect(mockRepo.findById).toHaveBeenCalled();  // bare toHaveBeenCalled
  });

  it('creates a user', async () => {
    mockRepo.findByEmail.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({ id: '2', email: 'b@b.com', name: 'Bob' });
    const user = await service.createUser('b@b.com', 'Bob');
    expect(user).toBeDefined();  // shallow
  });

  // No error tests — testkit should flag missing error coverage
});
