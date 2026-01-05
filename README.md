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
- **Disk caching of remote links**: To speed up subsequent builds, a tab-delimited text file is optionally written to disk containing the contents of all remote links checked and the status code returned by the server, in the form URL<tab>ok/failed<tab>status code<tab>ISO-8601-formatted timestamp.




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
import astroBrokenLinksChecker from 'astro-broken-link-checker';

export default defineConfig({
  // ... other configurations ...
  integrations: [
    astroBrokenLinksChecker({
      logFilePath: 'broken-links.log', // Optional: specify the log file path
      checkExternalLinks: false, // Optional: check external links (currently, caching to disk is not supported, and it is slow)
      throwError: true // Optional: throw an error to fail the build if broken links are found. Defaults to false.
    }),
  ],
});
```
