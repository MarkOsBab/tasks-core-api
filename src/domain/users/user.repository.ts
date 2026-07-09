import { Prisma, type User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { BaseRepository, type ModelDelegate } from '../base/base.repository';

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(prisma.user as unknown as ModelDelegate<User>, {
      searchable: ['name', 'lastName', 'email'],
      sortable: ['id', 'name', 'lastName', 'email', 'createdAt'],
    });
  }

  /** ?q on name/lastName (insensitive), ordered by name, top 50. */
  selectOptions(q: string | null): Promise<User[]> {
    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};
    return prisma.user.findMany({ where, orderBy: { name: 'asc' }, take: 50 });
  }
}

export const userRepository = new UserRepository();
