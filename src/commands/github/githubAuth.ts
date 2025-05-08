import { execSync } from 'child_process';

/**
 * Check if the GitHub CLI is available and logged in
 */
export function isGitHubCliAvailable(): boolean {
  try {
    // Check if gh is installed
    execSync('command -v gh', { stdio: 'ignore' });

    // Check if gh is logged in
    execSync('gh auth status', { stdio: 'ignore' });

    return true;
  } catch {
    return false;
  }
}

/**
 * Try to get GitHub credentials from git credential helper
 * Returns undefined if no credentials are found or if there's an error
 */
export function getGitCredentials(): { username: string; password: string } | undefined {
  try {
    // Prepare input for git credential fill
    const input = 'protocol=https\nhost=github.com\n\n';

    // Run git credential fill
    const output = execSync('git credential fill', {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'], // Ignore stderr to prevent warning messages
    });

    // Parse the output
    const lines = output.split('\n');
    const credentials: { [key: string]: string } = {};

    for (const line of lines) {
      const [key, value] = line.split('=');
      if (key && value) {
        credentials[key.trim()] = value.trim();
      }
    }

    // Check if we have both username and password
    if (credentials.username && credentials.password) {
      return {
        username: credentials.username,
        password: credentials.password,
      };
    }

    return undefined;
  } catch {
    return undefined;
  }
}

let ghAuthLoginMessagePrinted = false;
/**
 * Try to get a GitHub token using various methods:
 * 1. Check environment variable
 * 2. If GitHub CLI is available and logged in, generate a token
 * 3. Try git credentials if available
 *
 * @returns The GitHub token if available, undefined otherwise
 */
export function getGitHubToken(): string | undefined {
  // First check environment variable
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  // Then try GitHub CLI
  if (isGitHubCliAvailable()) {
    try {
      // Generate a token with necessary scopes for PR/Issue operations
      const token = execSync('gh auth token', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'], // Ignore stderr to prevent warning messages
      }).trim();

      return token;
    } catch {
      if (!ghAuthLoginMessagePrinted) {
        console.error(
          'Failed to generate GitHub token using gh CLI. Run `gh auth login` to login to GitHub CLI.'
        );
        ghAuthLoginMessagePrinted = true;
      }
    }
  }

  // Finally, try git credentials
  const credentials = getGitCredentials();
  if (credentials) {
    // If the password looks like a token (starts with 'ghp_' or 'gho_'), use it directly
    if (credentials.password.startsWith('ghp_') || credentials.password.startsWith('gho_')) {
      return credentials.password;
    }
  }

  return undefined;
}

/**
 * Get GitHub authentication headers for API requests
 */
export function getGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  // First try to get a token
  const token = getGitHubToken();
  if (token) {
    headers['Authorization'] = `token ${token}`;
    return headers;
  }

  // If no token, try git credentials for Basic Auth
  const credentials = getGitCredentials();
  if (credentials) {
    const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
    headers['Authorization'] = `Basic ${auth}`;
  }

  return headers;
}
