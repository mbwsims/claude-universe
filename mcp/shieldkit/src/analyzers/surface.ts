/**
 * Attack surface mapper.
 *
 * Discovers API endpoints, .env files, database access files,
 * and checks for auth protection and gitignore coverage.
 */

import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import {
  discoverRouteFiles,
  discoverEnvFiles,
  discoverDbFiles,
  detectFramework,
  checkGitignore,
} from './discovery.js';
import { analyzeAuth } from './missing-auth.js';

const execFileAsync = promisify(execFile);

export interface EndpointInfo {
  path: string;
  hasAuth: boolean;
}

export interface EnvFileInfo {
  path: string;
  gitignored: boolean;
  committedToGit: boolean;
}

export interface SurfaceResult {
  endpoints: EndpointInfo[];
  envFiles: EnvFileInfo[];
  dbAccessFiles: number;
  framework: string | null;
}

/**
 * Check if a file was ever committed to git history.
 * Returns false if not a git repo or git is not available.
 */
async function wasCommittedToGit(cwd: string, filePath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      'git', ['log', '--all', '--oneline', '--', filePath],
      { cwd, timeout: 5000 }
    );
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function analyzeSurface(cwd: string): Promise<SurfaceResult> {
  const [routeFiles, envFiles, dbFiles, framework] = await Promise.all([
    discoverRouteFiles(cwd),
    discoverEnvFiles(cwd),
    discoverDbFiles(cwd),
    detectFramework(cwd),
  ]);

  // Check auth for each route file
  const endpoints: EndpointInfo[] = [];
  for (const routeFile of routeFiles) {
    try {
      const content = await readFile(join(cwd, routeFile), 'utf-8');
      const hasAuth = analyzeAuth(content);
      endpoints.push({ path: routeFile, hasAuth });
    } catch {
      endpoints.push({ path: routeFile, hasAuth: false });
    }
  }

  // Check gitignore and git history for each env file
  const envFileInfos: EnvFileInfo[] = [];
  for (const envFile of envFiles) {
    const [gitignored, committedToGit] = await Promise.all([
      checkGitignore(cwd, envFile),
      wasCommittedToGit(cwd, envFile),
    ]);
    envFileInfos.push({ path: envFile, gitignored, committedToGit });
  }

  return {
    endpoints,
    envFiles: envFileInfos,
    dbAccessFiles: dbFiles.length,
    framework,
  };
}
