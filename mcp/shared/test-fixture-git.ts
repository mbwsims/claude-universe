import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

const EXPECTED_FIXTURE_COMMITS = 15;
const LOCK_DIR_NAME = '.fixture-git-lock';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCommitCount(fixtureDir: string): Promise<number | null> {
  try {
    const { stdout } = await execFile('git', ['rev-list', '--count', '--all'], {
      cwd: fixtureDir,
    });
    return Number.parseInt(stdout.trim(), 10);
  } catch {
    return null;
  }
}

async function fixtureHistoryReady(fixtureDir: string): Promise<boolean> {
  if (!existsSync(join(fixtureDir, '.git'))) {
    return false;
  }

  return (await getCommitCount(fixtureDir)) === EXPECTED_FIXTURE_COMMITS;
}

async function acquireLock(lockDir: string): Promise<void> {
  for (;;) {
    try {
      await mkdir(lockDir);
      return;
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (code !== 'EEXIST') {
        throw error;
      }
      await sleep(50);
    }
  }
}

export async function ensureFixtureGitHistory(fixtureDir: string): Promise<void> {
  if (await fixtureHistoryReady(fixtureDir)) {
    return;
  }

  const lockDir = join(fixtureDir, LOCK_DIR_NAME);
  await acquireLock(lockDir);

  try {
    if (await fixtureHistoryReady(fixtureDir)) {
      return;
    }

    await execFile('bash', ['./setup-git-history.sh'], {
      cwd: fixtureDir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Fixture Bot',
        GIT_AUTHOR_EMAIL: 'fixture@example.com',
        GIT_COMMITTER_NAME: 'Fixture Bot',
        GIT_COMMITTER_EMAIL: 'fixture@example.com',
      },
      maxBuffer: 10 * 1024 * 1024,
    });
  } finally {
    await rm(lockDir, { recursive: true, force: true });
  }
}
