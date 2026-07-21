import type { User } from '@prisma/client';
import type { AuthUser } from '@/lib/auth/context';
import { hashPassword } from '@/lib/auth/password';
import { passwordResetService } from '../auth/password-reset.service';
import { BaseService } from '../base/base.service';
import { UserRepository, userRepository } from './user.repository';

class UserService extends BaseService<User> {
  constructor(private readonly users: UserRepository) {
    super(users);
  }

  selectOptions(q: string | null) {
    return this.users.selectOptions(q);
  }

  // Users are created without a password (schema doesn't accept one): they get an invite
  // email with a set-password link. sendInvite never throws — the user row must survive
  // an SES hiccup, and in dev the link is logged server-side instead.
  override async create(data: Record<string, unknown>, user?: AuthUser): Promise<User> {
    const created = await super.create(data, user);
    await passwordResetService.sendInvite(created);
    return created;
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
