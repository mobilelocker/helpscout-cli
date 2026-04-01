# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by opening a [GitHub issue](../../issues) or emailing [support@mobilelocker.com](mailto:support@mobilelocker.com).

Please include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

We will respond within 5 business days.

## Credential Handling

This tool reads credentials exclusively from environment variables (`HELPSCOUT_APP_ID`, `HELPSCOUT_APP_SECRET`, `HELPSCOUT_API_KEY`). No credentials are ever written to disk except for the OAuth access token, which is cached at `~/.cache/helpscout/token.json` with user-only file permissions.

The cached token file contains a bearer token and refresh token. Protect it accordingly.
