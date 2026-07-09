import bcrypt from 'bcryptjs';

// bcryptjs verifies $2y$/$2a$/$2b$ hashes interchangeably.
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
