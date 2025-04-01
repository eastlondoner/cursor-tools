import { NetworkError, ProviderError } from '../errors';
import { ignorePatterns, includePatterns } from '../repomix/repomixConfig';

/**
 * Parse a GitHub URL or repository identifier string
 * @param url GitHub repository URL or identifier (username/reponame[@branch])
 * @returns Object containing username, reponame, and optional branch
 */
export function parseGithubUrl(url: string): {
  username: string;
  reponame: string;
  branch?: string;
} {
  // Handle full HTTPS URL format
  if (url.startsWith('https://github.com/')) {
    const parts = url.replace('https://github.com/', '').split('/');
    const [username, repoWithBranch] = parts;
    const [reponame, branch] = repoWithBranch.split('@');
    return { username, reponame, branch };
  }

  // Handle username/reponame@branch format
  const [repoPath, branch] = url.split('@');
  const parts = repoPath.split('/');
  if (parts.length !== 2) {
    throw new ProviderError(
      'Invalid GitHub repository format. Use either https://github.com/username/reponame[@branch] or username/reponame[@branch]'
    );
  }

  return { username: parts[0], reponame: parts[1], branch };
}

/**
 * Check if a string looks like a GitHub repository reference
 * @param query String to check
 * @returns True if the string looks like a GitHub repository reference
 */
export function looksLikeGithubRepo(query: string): boolean {
  // Check if it's a GitHub URL
  if (query.startsWith('https://github.com/')) {
    return true;
  }

  // Check if it matches the pattern owner/repo[@branch]
  // This regex checks for: alphanumeric+hyphens/alphanumeric+hyphens[@anything]
  const repoPattern = /^[\w-]+\/[\w-]+(?:@[\w-./]+)?$/;
  return repoPattern.test(query);
}

/**
 * Fetch and pack a GitHub repository
 * @param repoPath GitHub repository path (username/reponame[@branch])
 * @param maxRepoSizeMB Maximum repository size in MB
 * @returns Repository context as text and token count
 */
export async function getGithubRepoContext(
  repoPath: string,
  maxRepoSizeMB: number = 100
): Promise<{ text: string; tokenCount: number }> {
  const { username, reponame, branch } = parseGithubUrl(repoPath);
  const repoIdentifier = `${username}/${reponame}`;

  // First check repository size using GitHub API
  console.error('Checking repository size...');
  const sizeResponse = await fetch(`https://api.github.com/repos/${username}/${reponame}`);
  if (sizeResponse.ok) {
    const repoInfo = await sizeResponse.json();
    const sizeInMB = repoInfo.size / 1024; // size is in KB, convert to MB

    console.error(`Repository size: ${Math.round(sizeInMB)}MB (limit: ${maxRepoSizeMB}MB)`);

    // If repo is larger than the limit, throw an error
    if (sizeInMB > maxRepoSizeMB) {
      throw new ProviderError(
        `Repository ${repoIdentifier} is too large (${Math.round(sizeInMB)}MB) to process remotely.
The current size limit is ${maxRepoSizeMB}MB. You can:
1. Increase the limit by setting repo.maxRepoSizeMB in vibe-tools.config.json
2. Clone the repository locally and run without --from-github
3. The local processing will be more efficient and can handle larger codebases`
      );
    }
  } else {
    console.error('Could not determine repository size, proceeding anyway...');
  }

  console.error('Fetching GitHub repository:', repoIdentifier, branch ? `(branch: ${branch})` : '');

  const MAX_RETRIES = 3;
  const INITIAL_DELAY = 1000; // 1 second

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const formData = new FormData();
      formData.append(
        'url',
        `https://github.com/${repoIdentifier}` + (branch ? `/blob/${branch}` : '')
      );
      formData.append('format', 'xml');
      formData.append(
        'options',
        JSON.stringify({
          removeComments: false,
          removeEmptyLines: true,
          showLineNumbers: false,
          fileSummary: true,
          directoryStructure: true,
          outputParsable: false,
          includePatterns: includePatterns.join(','),
          ignorePatterns: ignorePatterns.join(','),
        })
      );

      const response = await fetch('https://api.repomix.com/api/pack', {
        headers: {
          accept: '*/*',
          'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
          priority: 'u=1, i',
          Referer: 'https://repomix.com/',
        },
        body: formData,
        method: 'POST',
      });

      if (response.ok) {
        const responseText = await response.text();
        try {
          // Try to parse as JSON to get metadata
          const responseJson = JSON.parse(responseText);
          const tokenCount = responseJson.metadata?.summary?.totalTokens;
          console.error(
            `Repository content token count (approximately): ${Math.round(tokenCount / 1000)}K tokens`
          );
          return { text: responseJson.content, tokenCount: tokenCount || 0 };
        } catch {
          // If parsing fails, return the text without token count
          console.error(
            'Could not parse token count from response, proceeding without token information'
          );
          return { text: responseText, tokenCount: 0 };
        }
      }

      const errorText = await response.text();

      // Check if error might be size-related
      if (
        errorText.toLowerCase().includes('timeout') ||
        errorText.toLowerCase().includes('too large')
      ) {
        throw new ProviderError(
          `Repository ${repoIdentifier} appears to be too large to process remotely.
Please:
1. Clone the repository locally
2. Run without --from-github
3. The local processing will be more efficient and can handle larger codebases`
        );
      }

      // If this is the last attempt, throw the error
      if (attempt === MAX_RETRIES) {
        throw new NetworkError(
          `Failed to fetch GitHub repository context: ${response.statusText}\n${errorText}`
        );
      }

      // For 5xx errors (server errors) and 429 (rate limit), retry
      // For other errors (like 4xx client errors), throw immediately
      if (!(response.status >= 500 || response.status === 429)) {
        throw new NetworkError(
          `Failed to fetch GitHub repository context: ${response.statusText}\n${errorText}`
        );
      }

      // Calculate delay with exponential backoff and jitter
      const delay = INITIAL_DELAY * 2 ** (attempt - 1) * (0.5 + Math.random());
      console.error(
        `Retrying (${attempt}/${MAX_RETRIES}) after ${Math.round(delay)}ms due to error: ${response.status} ${response.statusText}`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    } catch (error) {
      // If this is the last attempt, rethrow the error
      if (attempt === MAX_RETRIES) {
        throw new NetworkError(
          `Failed to fetch GitHub repository: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      // Calculate delay with exponential backoff and jitter
      const delay = INITIAL_DELAY * 2 ** (attempt - 1) * (0.5 + Math.random());
      console.error(
        `Retrying (${attempt}/${MAX_RETRIES}) after ${Math.round(delay)}ms due to error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs a return value
  throw new NetworkError('Failed to fetch GitHub repository after maximum retries');
}
