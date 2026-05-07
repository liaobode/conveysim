let counter = 0;

export function generateId(prefix = 'c'): string {
  return `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;
}
