const pad = (n: number) => String(n).padStart(2, '0');

/** DD/MM/YYYY (UTC getters so @db.Date values never shift a day) */
export function dmy(d: Date | null | undefined): string | null {
  if (!d) return null;
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** DD/MM/YYYY HH:MM:SS */
export function dmyHms(d: Date | null | undefined): string | null {
  if (!d) return null;
  return `${dmy(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** id ALWAYS as string; a raw BigInt would make Response.json throw. */
export function strId(id: bigint | number | string): string {
  return String(id);
}
