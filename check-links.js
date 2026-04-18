import {parse} from 'node-html-parser';
import fs from 'fs';
import {URL} from 'url';
import path from 'path';
import pLimit from 'p-limit';

/**
 * Load verified external links from a TSV cache file.
 * Format: URL\tok\tstatus_code\ttimestamp
 * @param {string} cachePath - Path to the cache file
 * @returns {Map<string, {status: string, statusCode: number, timestamp: string}>}
 */
export function loadExternalLinkCache(cachePath) {
  const cache = new Map();
  if (!fs.existsSync(cachePath)) {
    return cache;
  }

  const content = fs.readFileSync(cachePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const [url, status, statusCode, timestamp] = line.split('\t');
    if (url && status === 'ok') {
      cache.set(url, {
        status,
        statusCode: parseInt(statusCode, 10),
        timestamp
      });
    }
  }

  return cache;
}

/**
 * Save verified external links to a TSV cache file.
 * Only saves links that were successfully verified (ok status).
 * @param {string} cachePath - Path to the cache file
 * @param {Map<string, {status: string, statusCode: number, timestamp: string}>} cache
 */
export function saveExternalLinkCache(cachePath, cache) {
  const lines = [];
  for (const [url, data] of cache.entries()) {
    if (data.status === 'ok') {
      lines.push(`${url}\t${data.status}\t${data.statusCode}\t${data.timestamp}`);
    }
  }

  // Ensure directory exists
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {recursive: true});
  }

  fs.writeFileSync(cachePath, lines.join('\n'), 'utf8');
}

export async function checkLinksInHtml(
  htmlContent,
  brokenLinksMap,
  baseUrl,
  documentPath,
  checkedLinks = new Map(),
  distPath = '',
  astroConfigRedirects = {},
  logger,
  checkExternalLinks = true,
  trailingSlash = 'ignore',
  externalLinkCache = null,
  base = '',
) {
  const root = parse(htmlContent);
  const links = [
    ...root.querySelectorAll('a[href]').map((el) => el.getAttribute('href')),
    ...root.querySelectorAll('img[src]').map((el) => el.getAttribute('src')),
  ];

  const limit = pLimit(10);

  const checkLinkPromises = links.map((link) =>
    limit(async () => {
      if (!isValidUrl(link)) {
        return;
      }

      let absoluteLink;
      try {
        // Differentiate between absolute, domain-relative, and relative links
        if (/^https?:\/\//i.test(link) || /^:\/\//i.test(link)) {
          // Absolute URL
          absoluteLink = link;
        } else {
          absoluteLink = new URL(link, "https://localhost" + baseUrl).pathname;
        }
      } catch (err) {
        // Invalid URL, skip
        logger.error(`Invalid URL in ${normalizePath(documentPath)} ${link} ${err}`);
        return;
      }

      let fetchLink = link;
      if (absoluteLink.startsWith('/') && distPath) {
        fetchLink = absoluteLink;
      }

      // Check redirects with and without base prefix
      const redirectKey = (base && fetchLink.startsWith(base + '/'))
        ? fetchLink.slice(base.length)
        : fetchLink;
      const redirect = astroConfigRedirects[fetchLink] || astroConfigRedirects[redirectKey];
      if (redirect) {
        fetchLink = redirect.destination ? redirect.destination : redirect;
      }

      if (checkedLinks.has(fetchLink)) {
        const isValid = await checkedLinks.get(fetchLink);
        if (!isValid) {
          addBrokenLink(brokenLinksMap, documentPath, link, distPath);
        }
        return;
      }

      // Store an in-flight promise so concurrent checks for the same URL
      // coalesce onto a single fetch rather than each issuing their own request.
      let resolveCheck;
      const checkPromise = new Promise((resolve) => { resolveCheck = resolve; });
      checkedLinks.set(fetchLink, checkPromise);
      checkedLinks.set(absoluteLink, checkPromise);

      let isBroken = false;

      if (fetchLink.startsWith('/') && distPath) {
        // Internal link in build mode, check if file exists
        // Strip base path prefix if configured (e.g., base: '/docs')
        let relativePath = fetchLink;
        if (base && relativePath.startsWith(base + '/')) {
          relativePath = relativePath.slice(base.length);
        } else if (base && relativePath === base) {
          relativePath = '/';
        }
        // Potential file paths to check
        const possiblePaths = [
          path.join(distPath, relativePath),
          path.join(distPath, relativePath, 'index.html'),
          path.join(distPath, `${relativePath}.html`),
        ];

        // Check if any of the possible paths exist
        if (!possiblePaths.some((p) => fs.existsSync(p))) {
          isBroken = true;
        }

        // check trailing slash is correct on internal links
        const re = /\/$|\.[a-z0-9]+$/i;  // match trailing slash or file extension
        if (trailingSlash === 'always' && !fetchLink.match(re)) {
          isBroken = true;
        } else if (trailingSlash === 'never' && fetchLink !== '/' && fetchLink.endsWith('/')) {
          isBroken = true;
        }
      } else {
        // External link, check via HTTP request. Retry 3 times if ECONNRESET
        if (checkExternalLinks) {
          // Check the external link cache first
          if (externalLinkCache && externalLinkCache.has(fetchLink)) {
            // Link was previously verified as working, skip HTTP request
            isBroken = false;
          } else {
            let retries = 0;
            let statusCode = 0;
            while (retries < 3) {
              try {
                const response = await fetch(fetchLink, {
                  method: 'GET',
                  signal: AbortSignal.timeout(3000),
                });
                statusCode = response.status;
                isBroken = !response.ok;
                if (isBroken) {
                  logger.error(`${response.status} Error fetching ${fetchLink}`);
                }
                break;
              } catch (error) {
                isBroken = true;
                statusCode = error.errno === 'ENOTFOUND' ? 404 : 0;
                logger.error(`${statusCode || error.errno} error fetching ${fetchLink}`);
                if (error.errno === 'ECONNRESET' || error.name === 'TimeoutError') {
                  retries++;
                  if (retries < 3) {
                    await new Promise(r => setTimeout(r, 500 * Math.pow(2, retries - 1)));
                  }
                  continue;
                }
                break;
              }
            }

            // Cache successful external link checks
            if (!isBroken && externalLinkCache) {
              externalLinkCache.set(fetchLink, {
                status: 'ok',
                statusCode: statusCode,
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }

      resolveCheck(!isBroken);

      if (isBroken) {
        addBrokenLink(brokenLinksMap, documentPath, link, distPath);
      }
    })
  );

  await Promise.all(checkLinkPromises);
}

function isValidUrl(url) {
  // Skip mailto:, tel:, javascript:, and empty links
  return !(
    url.startsWith('mailto:') ||
    url.startsWith('tel:') ||
    url.startsWith('javascript:') ||
    url.startsWith('#') ||
    url.trim() === ''
  );
}

function normalizePath(p) {
  p = p.toString();
  // Remove query parameters and fragments
  p = p.split('?')[0].split('#')[0];

  // Remove '/index.html' or '.html' suffixes
  if (p.endsWith('/index.html')) {
    p = p.slice(0, -'index.html'.length);
  } else if (p.endsWith('.html')) {
    p = p.slice(0, -'.html'.length);
  }

  // Ensure leading '/'
  if (!p.startsWith('/')) {
    p = '/' + p;
  }

  return p;
}

export function normalizeHtmlFilePath(filePath, distPath = '') {
  return normalizePath(distPath ? path.relative(distPath, filePath) : filePath);
}

function addBrokenLink(brokenLinksMap, documentPath, brokenLink, distPath) {
  documentPath = normalizeHtmlFilePath(documentPath, distPath);
  if (!brokenLinksMap.has(brokenLink)) {
    brokenLinksMap.set(brokenLink, new Set());
  }
  brokenLinksMap.get(brokenLink).add(documentPath);
}
