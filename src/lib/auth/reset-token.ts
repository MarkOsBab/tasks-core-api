import { createHash, randomBytes } from 'node:crypto';

/** 64-hex-char single-use token; the raw value only travels inside the email link. */
export function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

/** Deterministic sha256 — what gets persisted/looked-up instead of the raw token. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
