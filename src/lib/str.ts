// camelCase -> snake_case, used to normalize sort fields against the sortable whitelist.
export function snake(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
