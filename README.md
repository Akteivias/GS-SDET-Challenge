# LoanPro SDET Challenge — User Management API Tests

End-to-end API contract tests for the User Management API, built with TypeScript and Playwright Test.

## Test suite baseline & known application defects

The test suite consists of **80 tests defined across 10 spec files**:

- **Dev environment**: 41 tests (includes cross-namespace isolation tests).
- **Prod environment**: 39 tests (`environment-isolation.spec.ts` is excluded because it evaluates cross-namespace isolation within a single instance).

### Published reports

The test suite publishes static Playwright HTML reports for both environments to GitHub Pages on every push to `main`:

- **Report landing page:** <https://akteivias.github.io/GS-SDET-Challenge/>
- **Dev report:** <https://akteivias.github.io/GS-SDET-Challenge/dev/>
- **Prod report:** <https://akteivias.github.io/GS-SDET-Challenge/prod/>

These are static Playwright HTML reports reflecting the latest test execution on `main`. Because the suite strictly asserts the authoritative OpenAPI contract, published reports will show test failures caused by documented application defects ([BUG-001 through BUG-005](./BUGS.md)).

As an alternate access method, raw report artifacts (`playwright-report-dev` and `playwright-report-prod`) can also be downloaded directly from the workflow summary page of each GitHub Actions run.

### Known defect outcomes

Tests in this suite assert the authoritative OpenAPI contract (`sdet_challenge_api.yml`). The current local baseline exits nonzero because contract assertions expose documented product defects. If the application is fixed, these tests are expected to pass.

Documented application defects (see [`BUGS.md`](./BUGS.md) for contract citations and reproduction steps):

- **BUG-001**: `PUT /users/{email}` reports updated values in response body, but subsequent `GET` returns original resource state (`dev`, `prod`).
- **BUG-002**: `GET /users/{email}` for a missing or deleted user returns HTTP 500 instead of 404 (`dev`, `prod`).
- **BUG-003**: `POST /users` with duplicate email returns HTTP 500 instead of 409 (`dev`, `prod`).
- **BUG-004**: `DELETE /users/{email}` accepts missing or invalid Authentication tokens with HTTP 204 in `dev`; `prod` conforms with HTTP 401.
- **BUG-005**: `POST /users` with invalid email format returns 201 Created and persists invalid record (`dev`, `prod`).

### Bug report

The bugs report file is being tracked on [`BUGS.md`](./BUGS.md)

## Prerequisites

- Node.js version matching `.nvmrc` (currently **24.21.0 LTS**)
- npm (bundled with Node.js)
- Docker (to run the API container locally)

The API authorization token defaults to the published challenge fixture; set `SDET_AUTH_TOKEN` in the environment to override it.

## Installation

```bash
npm ci
```

## Start the API locally

```bash
docker run -d -p 3000:3000 --name api-server \
  ghcr.io/danielsilva-loanpro/sdet-interview-challenge:latest
```

Verify the API is reachable:

```bash
# Verify dev namespace
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/dev/users
# Expected output: 200

# Verify prod namespace
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/prod/users
# Expected output: 200
```

To stop and remove the container:

```bash
docker stop api-server && docker rm api-server
```

## Type check

```bash
npm run typecheck
```

## Lint test code

```bash
npm run lint:tests
```

## Run the full suite

### Dev environment

```bash
npm run test:dev
```

### Prod environment

```bash
npm run test:prod
```

## Run a specific test file

```bash
npm run test:dev -- tests/scenarios/put-contract.spec.ts
npm run test:prod -- tests/scenarios/put-contract.spec.ts
```

## Run tests matching a pattern or tag

```bash
# Filter by test name or rule
npm run test:dev -- --grep "R01"
npm run test:prod -- --grep "R01"

# Filter by tag
npm run test:dev -- --grep "@contract"
```

## Save reports to a custom folder

```bash
PLAYWRIGHT_HTML_OPEN=never \
PLAYWRIGHT_HTML_OUTPUT_DIR=reports/my-run-dev \
npm run test:dev -- tests/user-contract-rules.spec.ts
```

## View reports

Open `<report-directory>/index.html`, for example `reports/my-run-dev/index.html`, or run:

```bash
npx playwright show-report reports/my-run-dev
```

## CI / GitHub Actions

The repository defines a GitHub Actions workflow in [`.github/workflows/playwright.yml`](./.github/workflows/playwright.yml) with independent `test-dev` and `test-prod` jobs running on `ubuntu-24.04`. It is configured to trigger on push and pull request to `main`, as well as manual dispatch (`workflow_dispatch`), and uploads test reports using `if: ${{ !cancelled() }}`.

Hosted-runner execution is verified. Its independent dev and prod jobs uploaded the `playwright-report-dev` and `playwright-report-prod` HTML-report artifacts. The run contains the expected contract assertion failures documented in [`BUGS.md`](./BUGS.md).

## Project structure

- `sdet_challenge_api.yml` — authoritative OpenAPI contract.
- `BUGS.md` — bug reports with contract references and reproduction evidence.
- `tests/helpers/user-validator.ts` — AJV validators compiled from `sdet_challenge_api.yml`.
- `tests/user-contract-rules.spec.ts` — contract rule coverage (R01, R04, R06–R08, R10–R12, R14, R16, R17).
- `tests/scenarios/` — scenario-focused specs for lifecycle, bug exposure, age boundaries, and environment isolation.

## Architecture & design decisions

- **Real API Execution**: Tests exercise the real containerized API and do not mock HTTP responses.
- **Direct Request Fixtures**: Uses native Playwright `request` fixtures and direct HTTP calls without Page Object Models or custom wrapper layers, keeping contract verification transparent and maintainable.
- **OpenAPI-Derived Response Conformance**: Response schemas (`User`, `ErrorResponse`, `User[]`) are compiled directly from `sdet_challenge_api.yml` using strict AJV validation; status codes and media types are asserted before body parsing.
- **Deterministic Serial Execution**: Tests run with `workers: 1` and `retries: 0`; serial execution reduces shared-state concurrency and makes failures easier to diagnose reproducibly.
- **Dynamic State Isolation & Cleanup**: Stateful tests generate UUID-scoped data and clean up created resources in guarded `finally` blocks without assuming an empty pre-existing database.
- **Hierarchical Step Reporting**: Multi-phase scenarios (cross-namespace isolation and multi-step security assertions) use native `await test.step()` blocks to organize workflow phases cleanly in HTML reports without adding third-party plugins.
- **Defect Visibility & Reporting**: Tests continue to expose documented product defects; failures remain visible rather than skipped, retried, or converted to passing expectations. Known issues are traceable to [`BUGS.md`](./BUGS.md) via test metadata tags (`@bug-001` through `@bug-005`).
