# Contributing

## Development Setup

```sh
git clone https://github.com/mobilelocker/helpscout-cli.git helpscout-cli
cd helpscout-cli
npm install
```

Run from source without building:

```sh
node bin/helpscout.js <command>
```

## Testing

```sh
npm test                  # unit tests only (no live Help Scout calls)
npm run test:integration  # live API tests (opt-in; needs credentials)
npm run lint              # check for lint errors
npm run lint:fix          # auto-fix lint errors
npm run format            # format with Prettier
```

Unit tests use Node's built-in `node:test` and never call Help Scout. Live integration tests in `test/integration/` are **opt-in**: they run only when `HELPSCOUT_RUN_INTEGRATION=1` is set (as with `npm run test:integration`). They also need the usual credentials (`HELPSCOUT_API_KEY` for Docs; `HELPSCOUT_APP_ID`, `HELPSCOUT_APP_SECRET`, and a cached OAuth token for Mailbox). Without the flag, those tests are skipped even if credentials are present in your environment.

Pre-commit hooks run ESLint and Prettier on staged files automatically.

## Pull Requests

- Open an issue first for significant changes
- Keep PRs focused — one feature or fix per PR
- Add or update tests for any changed behavior
- Make sure `npm test` and `npm run lint` pass before submitting
- Commits use standard GitHub conventions: plain imperative subjects (no `MLH-` / Jira prefix); link or close issues with `#123` / `Closes #123` (see `CLAUDE.md`)
