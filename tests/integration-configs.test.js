import { describe, it, expect, afterAll } from 'vitest';
import { build } from 'astro';
import path from 'path';
import fs from 'fs';
import astroBrokenLinksChecker from '../index.js';

const testsDir = import.meta.dirname;
const fixtureDir = path.join(testsDir, 'fixtures', 'no-broken-links');

// Track directories to clean up
const cleanupDirs = [];

function trackDir(dir) {
  cleanupDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of cleanupDirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true });
    }
  }
});

let testCounter = 0;

async function buildWith(opts) {
  const outDir = opts.outDir || './dist-test/';
  // Each test gets its own linkCheckerDir to avoid conflicts with other test files
  const linkCheckerDir = opts.linkCheckerDir || path.join(testsDir, `.link-checker-cfg-${++testCounter}`);
  const fullOutDir = path.join(testsDir, outDir);

  trackDir(fullOutDir);
  trackDir(linkCheckerDir);

  // Clean previous build output (but leave linkCheckerDir for cache/stale-log tests)
  if (fs.existsSync(fullOutDir)) fs.rmSync(fullOutDir, { recursive: true });

  const buildPromise = build({
    root: opts.root || testsDir,
    configFile: false,
    outDir: fullOutDir,
    base: opts.base,
    trailingSlash: opts.trailingSlash,
    redirects: opts.redirects || { '/redirected': '/about' },
    integrations: [astroBrokenLinksChecker({
      checkExternalLinks: opts.checkExternalLinks ?? false,
      cacheExternalLinks: opts.cacheExternalLinks ?? true,
      throwError: opts.throwError ?? false,
      ignore: opts.ignore,
      linkCheckerDir,
    })],
    logLevel: 'silent',
  });

  if (opts.throwError) {
    return buildPromise;
  }

  await buildPromise;

  const logFile = path.join(linkCheckerDir, 'broken-links.log');

  return {
    logExists: fs.existsSync(logFile),
    logContent: fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf-8') : '',
    outDir: fullOutDir,
    linkCheckerDir,
  };
}

describe('trailingSlash: always', () => {
  it('flags links without trailing slash', async () => {
    const result = await buildWith({
      outDir: './dist-trailing-always/',
      trailingSlash: 'always',
    });

    // /non-existent-page has no trailing slash → broken for two reasons (missing + no slash)
    expect(result.logContent).toContain('/non-existent-page');
    // /trailing-slash/ has trailing slash → should NOT be flagged for slash violation
    // (it exists as a file, and has a slash)
    expect(result.logContent).not.toContain('Broken link: /trailing-slash/');
  });
}, 60000);

describe('trailingSlash: ignore', () => {
  it('does not flag trailing slash violations', async () => {
    const result = await buildWith({
      outDir: './dist-trailing-ignore/',
      trailingSlash: 'ignore',
    });

    // In 'never' mode, /trailing-slash/ would be flagged. In 'ignore' mode, it should not be.
    expect(result.logContent).not.toContain('Broken link: /trailing-slash/');
    // Non-existent pages are still broken regardless of slash mode
    expect(result.logContent).toContain('/non-existent-page');
  });
}, 60000);

describe('base path: /docs', () => {
  it('handles base-prefixed links correctly', async () => {
    const result = await buildWith({
      outDir: './dist-base-docs/',
      base: '/docs',
      trailingSlash: 'ignore',
    });

    // Valid pages with base prefix should NOT be broken
    expect(result.logContent).not.toContain('Broken link: /docs/about');
    // Non-existent pages should still be caught
    expect(result.logContent).toContain('non-existent');
  });
}, 60000);

describe('throwError option', () => {
  it('throws when broken links are found', async () => {
    await expect(buildWith({
      outDir: './dist-throw/',
      trailingSlash: 'never',
      throwError: true,
    })).rejects.toThrow(/[Bb]roken links/);
  });
}, 60000);

describe('cacheExternalLinks: false', () => {
  it('does not create a cache file', async () => {
    const result = await buildWith({
      outDir: './dist-no-cache/',
      cacheExternalLinks: false,
      checkExternalLinks: false,
    });

    const cacheFile = path.join(result.linkCheckerDir, 'verified-external-links.tsv');
    expect(fs.existsSync(cacheFile)).toBe(false);
  });
}, 60000);

describe('no broken links', () => {
  it('does not create a log file when all links are valid', async () => {
    const linkCheckerDir = path.join(testsDir, '.link-checker-clean');
    trackDir(linkCheckerDir);
    if (fs.existsSync(linkCheckerDir)) fs.rmSync(linkCheckerDir, { recursive: true });

    const result = await buildWith({
      root: fixtureDir,
      outDir: './dist-clean/',
      redirects: {},
      linkCheckerDir,
    });

    expect(result.logExists).toBe(false);
  });

  it('removes a stale log file when no broken links are found', async () => {
    const linkCheckerDir = path.join(testsDir, '.link-checker-stale');
    trackDir(linkCheckerDir);
    if (fs.existsSync(linkCheckerDir)) fs.rmSync(linkCheckerDir, { recursive: true });

    // First build to create the linkCheckerDir
    await buildWith({
      root: fixtureDir,
      outDir: './dist-stale/',
      redirects: {},
      linkCheckerDir,
    });

    // Plant a stale log file
    const staleLog = path.join(linkCheckerDir, 'broken-links.log');
    fs.writeFileSync(staleLog, 'old broken link data', 'utf-8');
    expect(fs.existsSync(staleLog)).toBe(true);

    // Rebuild — should remove the stale log
    const result = await buildWith({
      root: fixtureDir,
      outDir: './dist-stale/',
      redirects: {},
      linkCheckerDir,
    });

    expect(result.logExists).toBe(false);
  });
}, 60000);

describe('custom linkCheckerDir', () => {
  it('writes to custom directory', async () => {
    const customDir = path.join(testsDir, '.custom-checker');
    trackDir(customDir);

    const result = await buildWith({
      outDir: './dist-custom-dir/',
      trailingSlash: 'never',
      linkCheckerDir: customDir,
    });

    expect(result.logExists).toBe(true);
    expect(result.logContent).toContain('Broken link');

    // Verify .gitignore was created in the custom directory
    expect(fs.existsSync(path.join(customDir, '.gitignore'))).toBe(true);
  });
}, 60000);

describe('ignore option', () => {
  it('excludes ignored links from the log', async () => {
    const result = await buildWith({
      outDir: './dist-ignore/',
      trailingSlash: 'ignore',
      ignore: ['/non-existent-page*'],
    });

    expect(result.logContent).not.toContain('non-existent-page');
  });

  it('still reports links that no pattern matches', async () => {
    const result = await buildWith({
      outDir: './dist-ignore-partial/',
      trailingSlash: 'ignore',
      ignore: ['/some-other-path'],
    });

    expect(result.logContent).toContain('non-existent-page');
  });
}, 60000);
