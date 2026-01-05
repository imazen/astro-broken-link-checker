# NPM Publishing Guide

This document explains how to publish `astro-broken-links-checker` to NPM.

## Prerequisites

1. **NPM Account**: You need an NPM account with publishing permissions for this package
2. **NPM Token**: An NPM authentication token with publish access must be added as a GitHub secret

## Setup Instructions

### 1. Add NPM Token to GitHub

#### Option A: Granular Access Token (Recommended)

Create a granular access token for enhanced security:

1. Generate an NPM access token using the CLI:
   ```bash
   npm token create
   ```
   
   Or via the web interface:
   - Go to https://www.npmjs.com/settings/~/tokens
   - Click "Generate New Token" → "Granular Access Token"
   - Select appropriate package permissions
   - For CI/CD workflows, enable "Bypass 2FA for noninteractive automated workflows"
   - Set expiration (write tokens are limited to 90 days maximum)
   - Copy the generated token

2. Add the token to GitHub repository secrets:
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste the NPM token
   - Click "Add secret"

#### Option B: OIDC Trusted Publishing (Most Secure)

For the most secure deployment, consider adopting OIDC trusted publishing, which eliminates the need to generate and manage tokens. This approach uses GitHub's OIDC provider to authenticate directly with NPM.

See NPM's documentation on [Trusted Publishers](https://docs.npmjs.com/about-trusted-publishers) for setup instructions.

### 2. Automatic Publishing

Once the `NPM_TOKEN` secret is configured, the package will automatically publish to NPM when:

1. Code is pushed to the `main` branch
2. All tests pass successfully

The GitHub Actions workflow (`.github/workflows/ci.yml`) handles this automatically.

## Manual Publishing (Alternative)

If you prefer to publish manually:

```bash
# 1. Ensure you're logged in to NPM
npm login

# 2. Run tests to ensure everything works
npm test

# 3. Publish to NPM
npm publish
```

## Package Configuration

The following changes were made to prepare the package for NPM:

### package.json Updates

- **license**: Changed from "Apache License 2.0" to "Apache-2.0" (SPDX identifier)
- **repository**: Added Git repository URL
- **bugs**: Added issues URL
- **homepage**: Added README URL
- **files**: Specified which files to include in the published package:
  - `index.js` - Main entry point
  - `check-links.js` - Core functionality
  - `README.md` - Documentation
  - `LICENSE` - License file

### .npmignore

Created to exclude development and test files from the published package:
- Test files and directories
- Development configuration files
- GitHub Actions workflows
- Build artifacts and logs

### Package Verification

You can verify what will be published by running:

```bash
npm pack --dry-run
```

This should show only 5 files:
- LICENSE
- README.md
- check-links.js
- index.js
- package.json

## Version Updates

Before publishing a new version:

1. Update the version in `package.json`:
   ```bash
   npm version patch  # for bug fixes
   npm version minor  # for new features
   npm version major  # for breaking changes
   ```

2. Push the changes and tag to GitHub:
   ```bash
   git push origin main --follow-tags
   ```

3. The CI will automatically publish the new version

## Verification

After publishing, verify the package is available:

```bash
npm view astro-broken-links-checker
```

Or install it in a test project:

```bash
npm install astro-broken-links-checker
```
