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
npm test          # run all unit tests
npm run lint      # check for lint errors
npm run lint:fix  # auto-fix lint errors
npm run format    # format with Prettier
```

Unit tests use Node's built-in `node:test` and run without credentials. Integration tests (in `test/integration/`) require `HELPSCOUT_APP_ID`, `HELPSCOUT_APP_SECRET`, and `HELPSCOUT_API_KEY` to be set and are skipped automatically when they are not.

Pre-commit hooks run ESLint and Prettier on staged files automatically.

## Pull Requests

- Open an issue first for significant changes
- Keep PRs focused — one feature or fix per PR
- Add or update tests for any changed behavior
- Make sure `npm test` and `npm run lint` pass before submitting
