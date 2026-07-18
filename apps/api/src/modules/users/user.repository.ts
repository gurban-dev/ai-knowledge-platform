import type { Prisma, User } from '@akp/db';
import { BaseRepository } from '../../lib/repository.js';

export interface CreateUserInput {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

/** Data access for the global `users` identity table. */
export class UserRepository extends BaseRepository<UserRepository> {
  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  /** Emails are stored/compared case-insensitively (normalized to lower-case). */
  async findByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.db.user.create({
      data: {
        id: input.id,
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: input.passwordHash,
      },
    });
  }

  async touchLastLogin(id: string, at: Date = new Date()): Promise<void> {
    await this.db.user.update({ where: { id }, data: { lastLoginAt: at } });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }
}
