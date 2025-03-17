export function exhaustiveMatchGuard(value: never, customError?: string) {
  throw new Error(`Unhandled case: ${value} ${customError ? `: ${customError}` : ''}`);
}
