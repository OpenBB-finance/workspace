# OpenBB Add-in for Excel

## Installation

```bash
npm ci
```

## Development

```bash
npm run dev
```

### Link UI kit

- Clone the [design-system](https://github.com/OpenBB-finance/design-system) to neighbor directory
- Install dependencies
- Link the package:

```bash
cd ../design-system
npm link
```

Then every time after reinstalling dependencies in this project:

```bash
npm link @openbb/ui
```

### .env variables

Use [.env.local](https://vitejs.dev/guide/env-and-mode.html#env-files) file to override values while developing locally.

#### Analytics Configuration

The add-in supports analytics configuration through environment variables:

- **VITE_ENV**: Deployment environment
  - `ONPREM`: Disables analytics for on-premise deployments
  - `DEVELOPMENT`: Disables analytics for development environments
  - `PRODUCTION`: Enables analytics (when PostHog variables are configured)
  - Other values: Enables analytics (when PostHog variables are configured)

- **VITE_POSTHOG_API_KEY**: PostHog API key (required for analytics)
- **VITE_POSTHOG_API_HOST**: PostHog API host (required for analytics)

**For On-Premise Deployments**: Set `VITE_ENV=ONPREM` to completely disable analytics. Analytics will also be automatically disabled if PostHog environment variables are missing.

### Generate custom functions & integration tests

The functions code and tests generation is done in 2 steps:

1. `spec_generator.py`: generate `spec.json` file from `openapi.json` and `widgets.json`
  1.1. `openapi.json` contains the REST API specification
  1.2. `widgets.json` is a TerminalPro asset that is fetched from [Terminal Pro](https://github.com/OpenBB-finance/terminalpro). It contains the functions that will be exposed in Excel and the providers (source) to be included in each function. Since that is a private repository you need to setup `GITHUB_PAT` in .env - get one [on the settings/tokens page](https://github.com/settings/tokens).
2. `ts_generator.py`: generate `functions.ts` and `functions.full.test.ts` from the `spec.json`

> Note 1: Only endpoints referenced in widgets.json will be translated to spec.json, thus exposed in Excel UI.
> Note 2: When a new provider brings additional parameters (in relation to previous Excel UI version) they are (or should if manually edited) added last in the function signature to avoid breaking previous workbooks.

To generate run:

```bash
conda create -n xl python=3.10 python-dotenv requests
conda activate xl
npm run generate
```

To generate custom functions/tests and update `openapi.json` run:

> Make sure .env.local specifies `VITE_PLATFORM_URL=https://sdk.openbb.co` or other `openapi.json` base url you prefer.

```bash
npm run generate:update
```

## Documentation

The [documentation](https://docs.openbb.co/excel) website should be updated any time the custom functions change. To update the docs go to the [terminal repo](https://github.com/OpenBB-finance/openbb-docs) and run:

```bash
cd OpenBBTerminal/website
python scripts/generate_excel_markdown.py
```

This will create a local version of the [reference](https://docs.openbb.co/excel/reference) section. This script will run automatically on every docs website deployment. To update the reference or other static documentation just re-deploy the website.

## Release

- Run the [custom functions generator](#generate-custom-functions--integration-tests) (optional since we might just want to fix a bug)
- Run the [full integration tests](#integration-tests)
- Push to the `main` branch and it will deploy to AWS via GitHub action
- Update the [documentation](#documentation)

If the new version introduces `manifest.xml` changes like a ribbon button or a new icon we need to publish a new Microsoft AppSource version, this means the following:

- Update version:

```bash
npm version patch
```

- Upload the manifest.xml to Microsoft Partner Center to become available in the AppSource following [How to publish to MS Office Store](https://openbb.atlassian.net/wiki/spaces/PROD/pages/356876289/How+to+publish+to+MS+Office+Store)

- If there are admin deployments to update:

  - go to Office 365 admin center > [Integrated Apps](https://admin.microsoft.com/?auth_upn=Disorder@3nxjkw.onmicrosoft.com&source=applauncher#/Settings/IntegratedApps)

  - Upload the new [manifest](https://excel.openbb.co/manifest.xml) file from server

## Usage

To create a production build, run:

```bash
npm run build
```

To start the development server, run:

```bash
npm run dev
```

To load the add-in in your desktop Excel, use any of the `start` scripts. e.g:

```bash
npm run start
```

> Note: If you are using Mac and need to enable the 'inspect' button in the taskpane, run `npm run office:tools-mac` and restart Excel. To see console and network for custom functions, inspect the taskpane from the sign-in page (before signing in) - the runtime is there and won't be available in other pages.

Alternatively, you can load the add-in manually to Excel on the web by following these steps:

1. Run `npm run build` to create a production build.
2. Go to Insert > Office Add-ins in Excel.
3. Click on the Manage My Add-ins dropdown.
4. Click on Upload My Add-in.
5. Select the manifest file from the `dist` folder.

## Tests

- Tests are split by projects, see `jest.config.js`, unit, integration-full, integration-smoke, etc.
- Running specific tests:

```bash
jest -i <path-to-test-file.ts> -t <partial-describe-content>

# Example
jest --verbose -i tests/integration/functions.smoke.test.ts -t OBB.G

# Output
PASS   integration-smoke  tests/integration/functions.smoke.test.ts
smokeTests
  OBB.GET
    ✓ Empty (4 ms)
    ✓ Full
    ✓ Partial (4 ms)
  OBB.EQUITY.PRICE.HISTORICAL
    ○ skipped 1 symbol
    ○ skipped 2+ symbols
    ○ skipped dates + provider
  OBB.EQUITY.FUNDAMENTAL.BALANCE
    ○ skipped 1 symbol
```

- To re-write snapshots, either delete them before running the test or use `--updateSnapshot`/`-u`

### Unit tests

```bash
npm run test:unit
```

### Integration tests

Set `TEST_PLATFORM_EMAIL` and `TEST_PLATFORM_PASSWORD` in .env.local. This token is the authorization token required to fetch data from OpenBB platform.

- Full

  ```bash
  npm run test:integration-full
  ```

- Smoke

  ```bash
  npm run test:integration-smoke
  ```

  > Note: smoke tests run on every push to `main` or `develop` branch. The GitHub secrets `DEV/PROD_VITE_TEST_PLATFORM_EMAIL` and  `DEV/PROD_VITE_TEST_PLATFORM_PASSWORD` must be populated to make request to the platform.

### All projects

```bash
npm run test
```

## Office Add-in React Vite Template

This is a template for developing an [Office.JS](https://learn.microsoft.com/en-us/office/dev/add-ins/) Excel add-in with **Vite** and **React 18**. The main advantage of using this template is a much faster development cycle. The development server starts in just 2-3 seconds and hot-reloaded changes are near instant.

## Key differences

This template was generated using the [generator-office](https://www.npmjs.com/package/generator-office) generator which is based on the [Office-Addin-Taskpane-React](https://github.com/OfficeDev/Office-Addin-TaskPane-React) project.

These are the key differences between this template and the default generated template:

- Use Vite instead of Webpack.
- Use React 18.
- Remove polyfills and support for IE 11.
- Enabled typescript strict mode

## Legacy Browsers

This template does not include support for IE11. If you need support, add [@vitejs/plugin-legacy](https://github.com/vitejs/vite/tree/main/packages/plugin-legacy).
