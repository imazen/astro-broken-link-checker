# NPM Publishing Guide

This document explains how to publish `astro-broken-links-checker` to NPM.

## Prerequisites

**NPM Account**: You need an NPM account with publishing permissions for this package

## Setup Instructions

### Option 1: Trusted Publishing with OIDC (Recommended)

Trusted Publishing uses GitHub's OIDC provider to authenticate directly with NPM, eliminating the need to manage tokens. This is the most secure option.

#### Setup Steps:

1. **Configure NPM Trusted Publisher**:
   - Log in to [npmjs.com](https://www.npmjs.com)
   - Go to your package page (or create the package if it doesn't exist yet)
   - Navigate to Settings → Publishing Access
   - Click "Add Trusted Publisher"
   - Select "GitHub Actions" as the provider
   - Fill in the required fields:
     - **Organization/Username**: `imazen`
     - **Repository**: `astro-broken-link-checker`
       - Note: Use the GitHub repository name, which is `astro-broken-link-checker` (singular "link")
       - The NPM package name is `astro-broken-links-checker` (plural "links"), but use the repository name here
     - **Workflow**: `ci.yml`
     - **Environment**: Leave blank (or specify if using GitHub Environments)
   - Save the configuration

2. **No GitHub Secrets Required**: With OIDC, you don't need to add any secrets to your GitHub repository. The workflow is already configured to use OIDC authentication with the `id-token: write` permission.

3. **Automatic Publishing**: Once configured, the package will automatically publish to NPM when code is pushed to the `main` branch and all tests pass.

**Note**: The GitHub Actions workflow has been updated to support provenance statements, which provide additional security and transparency.

### Option 2: Token-Based Authentication (Alternative)

If you prefer to use token-based authentication or if OIDC is not available:

#### Setup Steps:

1. **Generate an NPM Access Token**:
   - Go to https://www.npmjs.com/settings/~/tokens
   - Click "Generate New Token" → "Granular Access Token"
   - Select appropriate package permissions
   - For CI/CD workflows, enable "Bypass 2FA" for automated publishing workflows
   - Set expiration (granular write tokens are limited to 90 days maximum)
   - Copy the generated token

2. **Add Token to GitHub Repository Secrets**:
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste the NPM token
   - Click "Add secret"

3. **Automatic Publishing**: The package will automatically publish to NPM when code is pushed to the `main` branch and all tests pass.

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
