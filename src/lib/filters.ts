// PHP FILTER_VALIDATE_BOOLEAN equivalent for boolean query params.
export function boolFilter(value: string): boolean {
  return ['1', 'true', 'on', 'yes'].includes(value.toLowerCase());
}
