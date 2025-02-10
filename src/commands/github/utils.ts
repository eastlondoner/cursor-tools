import { execSync } from 'node:child_process';
import type { CommandOptions } from '../../types';

export interface GithubOptions extends CommandOptions {
  repo?: string;
  fromGithub?: string;
}

export interface RepoContext {
  owner: string;
  repo: string;
}

function parseRepoString(repoStr: string): RepoContext | null {
  const parts = repoStr.split('/');
  if (parts.length === 2) {
    return { owner: parts[0], repo: parts[1] };
  }
  console.error("Invalid repository format. Use 'owner/repo'");
  return null;
}

export async function getRepoContext(options?: GithubOptions): Promise<RepoContext | null> {
  // First try --from-github for consistency with other commands
  if (options?.fromGithub) {
    return parseRepoString(options.fromGithub);
  }

  // Then try --repo for backward compatibility
  if (options?.repo) {
    return parseRepoString(options.repo);
  }

  try {
    // Finally, try to get the remote URL from git (works if inside a git repo)
    const remoteUrl = execSync('git config --get remote.origin.url', { stdio: 'pipe' })
      .toString()
      .trim();

    // Extract owner and repo name from the URL. Handles both SSH and HTTPS URLs
    const match = remoteUrl.match(/github\.com[:/](.*?)\/(.*?)(?:\.git)?$/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch {
    // Not a git repository, or git command failed
    return null;
  }
  return null;
}
