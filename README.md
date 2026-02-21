# Astro Broken Links Checker

An Astro integration that checks for broken links in your website during static build. It logs any broken links to the console and writes them to a file, grouping them by the document in which they occur.

## Goals

- **Checks Internal and External Links**: Validates all `<a href="...">` links found in your HTML pages.
- **Logs Broken Links**: Outputs broken link information to both the console and a log file.
- **Grouped by broken URL**: To allow for quick search and replacement, a list of all pages containing the broken URL is logged.
- **Caching Mechanism**: Avoids redundant checks by caching the results of previously checked links, both internal and external, whether they are valid or not.
- **Parallel Processing**: Checks links and does IO and network operations in parallel to improve performance. We first collect all links from all pages, then only check each once, first loading the tsv cache, then saving it again when we are done. All http requests happen in parallel.
- **Local redirect awareness**: If a link is redirected in astro.config.mjs, it will be followed.
- **Timeouts and retries**: To avoid false positives, links that fail to load with ECONNRESET are retried 3 times with exponential backoff. Timeouts are set to 3 second max including retries.
- **Link text preservation**: The contents of "href" are only normalized to a domain-relative path (like /foo/bar/) if they are "../relative" or "./relative" or "relative" etc. It is otherwise preserved for reporting purposes.
- **Cross-platform compatibility**: The physical paths of the html files are normalized to domain relative paths.
- **Disk caching of verified external links**: To speed up subsequent builds, verified external links are cached to `.link-checker/verified-external-links.tsv`. This TSV file contains URL, status (ok), status code, and timestamp. Commit this file to git to avoid re-checking links on CI.

## Installation

Install the package using npm:

```bash
npm install astro-broken-links-checker
```

> [!NOTE]
> You can also install from GitHub if you need the latest development version:
> ```json
>   "dependencies": {
>     "astro": "5.16.6",
>     "astro-broken-links-checker": "imazen/astro-broken-link-checker"
>   }
> ```

Finally, update your `astro.config.mjs`
```js
import { defineConfig } from 'astro/config';
import astroBrokenLinksChecker from 'astro-broken-links-checker';

export default defineConfig({
  // ... other configurations ...
  integrations: [
    astroBrokenLinksChecker({
      checkExternalLinks: true,       // Optional: check external links (default: false)
      cacheExternalLinks: true,       // Optional: cache verified external links to disk (default: true)
      throwError: true,               // Optional: fail the build if broken links are found (default: false)
      linkCheckerDir: '.link-checker' // Optional: directory for cache and log files (default: '.link-checker')
    }),
  ],
});
```

## Output Directory

The integration creates a `.link-checker` directory containing:

- **`verified-external-links.tsv`** - Cache of verified external links (TSV format: URL, status, statusCode, timestamp). **Commit this file to git** to avoid re-checking links on CI builds.
- **`broken-links.log`** - Log of broken links found during build (gitignored).

The directory only appears in git when `verified-external-links.tsv` exists.
