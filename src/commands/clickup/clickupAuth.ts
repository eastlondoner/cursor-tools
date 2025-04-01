/**
 * Get ClickUp API token from environment
 */
export function getClickUpToken(): string | undefined {
  return process.env.CLICKUP_API_TOKEN;
}

/**
 * Get ClickUp authentication headers for API requests
 */
export function getClickUpHeaders(): Record<string, string> {
  const token = getClickUpToken();
  if (!token) {
    throw new Error(
      'CLICKUP_API_TOKEN environment variable is not set. Please set it in your .vibe-tools.env file.'
    );
  }

  return {
    Authorization: token,
    'Content-Type': 'application/json',
  };
}
