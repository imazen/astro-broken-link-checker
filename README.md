# Astro Broken Links Checker

An Astro integration that checks for broken links in your website during static builds. It validates internal links (and optionally external ones), logging any broken links to both the console and a file.

## Installation

```bash
npm install astro-broken-links-checker
```

Then add it to your `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import astroBrokenLinksChecker from 'astro-broken-links-checker';

export default defineConfig({
  integrations: [
    astroBrokenLinksChecker({
      checkExternalLinks: true, // default: false
      throwError: true,         // default: false
      ignore: [                 // default: [] (nothing ignored)
        '/preview/**',
        'https://twitter.com/**',
      ],
    }),
  ],
});
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `checkExternalLinks` | `boolean` | `false` | Also check external (http/https) links via HTTP requests. |
| `cacheExternalLinks` | `boolean` | `true` | Cache verified external links to disk to speed up subsequent builds. |
| `throwError` | `boolean` | `false` | Fail the build if any broken links are found. |
| `linkCheckerDir` | `string` | `'.link-checker'` | Directory for cache and log files. |
| `ignore` | `string \| RegExp \| Function \| Array` | `[]` | Links to skip entirely. See [Ignoring links](#ignoring-links). |

### Ignoring links

`ignore` accepts a single pattern or an array of patterns. A link is skipped — never checked, never reported — if any pattern matches either its raw `href` or its resolved absolute path.

```js
astroBrokenLinksChecker({
  ignore: [
    '/under-construction',       // exact match
    '/preview/*',                // glob: `*` matches within one path segment
    '/legacy/**',                // glob: `**` matches across `/`
    /^https:\/\/localhost:/,     // RegExp
    (link) => link.includes('?draft='), // predicate function
  ],
})
```

Pattern types:

- **String** — a glob. `*` matches any run of characters except `/`, `**` matches across `/`, and `?` matches a single non-`/` character. Everything else is literal, and the pattern must match the whole link.
- **RegExp** — tested against the link (the `g` flag is ignored, so matching is stateless).
- **Function** — receives the link and returns `true` to ignore it.

## Features

- **Checks `<a href>` and `<img src>`** references in all built HTML pages.
- **Ignore list**: Skip links by glob, RegExp, or predicate function.
- **Deduplication**: Each unique link is checked only once across all pages.
- **Parallel processing**: Pages (up to 50 concurrent) and HTTP requests (up to 10 concurrent) run in parallel.
- **Base path support**: Respects Astro's `base` config, stripping the prefix before checking file existence.
- **Redirect awareness**: Follows redirects defined in `astro.config.mjs`.
- **Trailing slash enforcement**: Respects Astro's `trailingSlash` setting and flags links that violate it.
- **Timeouts and retries**: External link checks have a 3-second timeout. ECONNRESET and timeout failures are retried up to 3 times with exponential backoff.
- **Disk caching**: Verified external links are cached to `.link-checker/verified-external-links.tsv`. Commit this file to skip re-checking on CI.

## Output

The integration creates a `.link-checker` directory containing:

- **`verified-external-links.tsv`** — Cache of verified external links (TSV: URL, status, statusCode, timestamp). **Commit this to git** to avoid re-checking on CI.
- **`broken-links.log`** — Broken links found during the build (gitignored automatically).

## Compatibility

- **Node.js**: 18+
- **Astro**: 4.x and 5.x

## License

[Apache-2.0](LICENSE)
