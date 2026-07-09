import type { User } from '@prisma/client';
import { hashPassword } from '@/lib/auth/password';
import { BaseService } from '../base/base.service';
import { UserRepository, userRepository } from './user.repository';

class UserService extends BaseService<User> {
  constructor(private readonly users: UserRepository) {
    super(users);
  }

  selectOptions(q: string | null) {
    return this.users.selectOptions(q);
  }

  protected async prepare(
    data: Record<string, unknown>,
    _existing: User | null,
  ): Promise<Record<string, unknown>> {
    const prepared = { ...data };
    if (typeof prepared.password === 'string' && prepared.password.length > 0) {
      prepared.password = await hashPassword(prepared.password);
    } else {
      delete prepared.password; // update without password = keep the current one
    }
    return prepared;
  }
}

export const userService = new UserService(userRepository);
