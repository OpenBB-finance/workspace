# Marketplace Developer Guide

This guide walks you through listing and testing your app in the OpenBB marketplace before it goes live.

## How It Works

1. You create your app via the API — it enters **development** mode
2. Only you can see it in the marketplace (log in to verify)
3. You iterate — update descriptions, fix your backend URLs, test widgets
4. When you're happy, message us: **"Version X.X is ready to publish"**
5. We review and publish it to all users

## Prerequisites

- An OpenBB account
- Your session token (from browser DevTools — look for the `Authorization: Bearer <TOKEN>` header in network requests)
- A backend that serves `widgets.json` and `apps.json` (see [Manifest Requirements](#manifest-requirements) below)

## Step 1 — Create Your App

This single request creates your vendor profile and app in one call:

```bash
curl -X POST https://payments.openbb.dev/marketplace/developer/apps \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_name": "Your Company Name",
    "vendor_description": "What your company does",
    "vendor_website_url": "https://yourcompany.com",
    "contact_email": "support@yourcompany.com",
    "app_name": "Your App Name",
    "version": "1.0",
    "short_description": "One-line description of your app",
    "category": "App category (optional)",
    "tagline": "One-line tagline shown under the app name in the marketplace (optional)",
    "thumbnail_url": "https://yourcompany.com/logo.png",
    "backend_base_url": "https://api.yourcompany.com",
    "auth_type": ["api_key"]
  }'
```

### Fields

| Field | Required | Description |
|---|---|---|
| `vendor_name` | Yes | Your company/team name. Created once, reused for future apps. |
| `vendor_description` | No | Brief description of your company |
| `vendor_website_url` | No | Your company website |
| `vendor_thumbnail_url` | No | Your company logo (URL or base64). Stored on the vendor record and shared across all of your apps — distinct from the per-app `thumbnail_url`. |
| `contact_email` | No | Support email shown to users |
| `app_name` | Yes | Display name for your app. **This is what users see** — it overrides `name` in your `apps.json`. |
| `version` | No | Version string (e.g. `"1.0"`, `"2.0"`). Defaults to `"1"` |
| `short_description` | Yes | One-line description shown in the marketplace. **This is what users see** — it overrides `description` in your `apps.json`. |
| `category` | No | Optional category shown above the app name in the marketplace. |
| `tagline` | No | Optional one-liner shown in the marketplace under the app name. |
| `thumbnail_url` | No | Default app thumbnail. URL or base64 string. **This is what users see** — it overrides `img` in your `apps.json`. |
| `thumbnail_url_dark` | No | Optional dark-mode variant of the thumbnail. URL or base64 string. Overrides `img_dark` in your `apps.json`. Falls back to `thumbnail_url` if unset. |
| `thumbnail_url_light` | No | Optional light-mode variant of the thumbnail. URL or base64 string. Overrides `img_light` in your `apps.json`. Falls back to `thumbnail_url` if unset. |
| `media` | No | Image / video / YouTube URLs shown in the app detail carousel (`MediaCarousel`). Rendering is picked per URL — see [Supported media URLs](#supported-media-urls) below. Also accepted under the legacy name `screenshots`. |
| `api_key_url` | No | Endpoint we call to verify a user's API key. See [API Key Verification](#api-key-verification) below. |
| `api_key_info_url` | No | URL to your docs explaining how users can get an API key. Shown alongside the "Add API Key" modal so users can click straight through to signup / key-generation instructions. |
| `backend_base_url` | Yes | Your backend URL. We'll look for `{base}/widgets.json` and `{base}/apps.json` here |
| `apps_json_url` | No | Override if your apps.json isn't at `{backend_base_url}/apps.json` |
| `widgets_json_url` | No | Override if your widgets.json isn't at `{backend_base_url}/widgets.json` |
| `auth_type` | No | Array of `"none"`, `"api_key"`, or `"custom"`. Defaults to `["api_key"]`. Allowed combinations: `["none"]`, `["api_key"]`, `["custom"]`, `["none", "api_key"]`, `["none", "custom"]`. **`["api_key", "custom"]` is rejected.** |
| `auth_fields` | If `auth_type` includes `"custom"` | Vendor-defined header fields shown in the connect modal. See [Custom Auth Fields](#custom-auth-fields) below. |

The response also includes `createdDate` and `updatedDate` (auto-populated, not settable). `createdDate` is when the app was first submitted; `updatedDate` is when any field was last modified or re-verification ran.

### Why some fields override your `apps.json`

The `app_name`, `short_description`, `category`, `thumbnail_url`, `thumbnail_url_dark`, and `thumbnail_url_light` values you submit here are what users see in the marketplace and inside the Workspace. They **override** the equivalent `name`, `description`, `category`, `img`, `img_dark`, and `img_light` fields in your `apps.json` manifest.

This means:

- You don't need to touch your `apps.json` to change how your app looks in the marketplace — just PATCH the app record.
- If we approve a specific marketing copy or thumbnail for your listing, your app will keep using it even if you later ship a different value in `apps.json`.
- Everything else in `apps.json` (tabs, widgets, prompts, groups, etc.) is still served from your manifest as-is.

### Supported media URLs

The `media` array is rendered under the description for each app in the marketplace. Each URL is classified independently and rendered with the right element:

| URL pattern | Renders as | Example |
|---|---|---|
| `youtube.com/*` or `youtu.be/*` | `<iframe>` embed | `https://www.youtube.com/watch?v=abc123` |
| `.mp4` / `.webm` / `.mov` / `.m4v` extension | `<video>` with native controls | `https://example.com/demo.mp4` |
| Everything else | `<img>` | `https://example.com/screenshot.png` |

You can mix types freely in the same array — the carousel handles each item based on its URL:

```json
{
  "media": [
    "https://example.com/hero.png",
    "https://www.youtube.com/watch?v=abc123",
    "https://example.com/walkthrough.mp4"
  ]
}
```

Notes and gotchas:

- **YouTube share links work** — both `youtube.com/watch?v=...` and `youtu.be/...` are accepted. The carousel converts them to the embed form internally, so you don't need to pre-format them.
- **Self-hosted videos need a direct file URL.** A page URL that returns HTML (e.g. a Vimeo "watch" page) will be classified as an image and break. Point at the actual `.mp4`/`.webm` asset.
- **CORS matters for videos.** Self-hosted video files must be served with `Access-Control-Allow-Origin` headers that allow the Workspace's origin, otherwise the browser will refuse to load them.
- **No URL validation at submit time.** The backend accepts any string in the array and doesn't fetch or verify it. If you submit a broken URL, the carousel will show a broken placeholder at render time — there's no server-side check to catch it.

### API Key Verification

When a user adds your app, they're prompted for an API key. We need to verify that key before saving it — and you get to choose how that verification works.

**Option A — Custom endpoint (`api_key_url` set)**

If you set `api_key_url`, the Workspace POSTs the user-provided key to that URL and expects a success/error response. This lets you:

- Fully control the verification flow (hit your auth service, check entitlements, whatever you need).
- Return a **custom error message** that gets shown directly to the user in the "Add API Key" modal — so you can be specific (e.g. *"This key doesn't have access to the Pro tier, upgrade at acmedata.com/pro"*) instead of a generic failure.

**Option B — Widget fallback (`api_key_url` not set)**

If you leave `api_key_url` empty, we verify the key by calling the **first widget in your `widgets.json`** with it. If the widget returns successfully, the key is considered valid. If it errors, the key is rejected.

In this mode, make sure that first widget returns a **clear, user-facing error message** when the key is invalid — because whatever error string it returns is what the user will see in the modal. A generic 401 or an obscure stack trace is a bad experience; prefer something like *"Invalid API key — check your key at acmedata.com/keys"*.

**`api_key_info_url` (both options)**

Independent of which verification mode you pick, set `api_key_info_url` to a page in your docs that explains how a user gets a key (signup page, dashboard link, whatever). The Workspace surfaces this next to the "Add API Key" modal so users can click straight through instead of hunting for your docs.

### Custom Auth Fields

Use `auth_type: ["custom"]` when your backend needs one or more named headers that don't fit the default `Authorization: Bearer ...` flow — e.g. an `X-Client-Id` alongside a token, or a non-`Bearer` auth header. The Workspace renders one input per `auth_fields` entry in the connect modal and sends each value as the named HTTP header on every request to your backend.

```json
{
  "auth_type": ["custom"],
  "auth_fields": [
    {
      "id": "api_key",
      "label": "API Key",
      "key": "Authorization",
      "prefix": "Bearer "
    },
    {
      "id": "client_id",
      "label": "Client ID",
      "key": "X-Client-Id"
    }
  ]
}
```

For each entry:

- `id` — stable form key (must be unique across the array).
- `label` — what the user sees as the field label in the connect modal.
- `key` — the HTTP header name we send to your backend (must be unique across the array).
- `prefix` — optional string prepended to the user's value before we send it (e.g. `"Bearer "`).

Notes:

- Order is preserved — `auth_fields[0]` is the first input shown.
- All fields are required at connect time.
- Use `["none", "custom"]` if you want to allow anonymous access *and* offer custom auth as an upgrade.
- **Don't pick `custom` for the standard single-key flow** — if all you need is `Authorization: Bearer <user_key>`, use `["api_key"]` (or `["none", "api_key"]` to allow anonymous). `custom` is for the cases the default flow can't express.
- `["api_key", "custom"]` is rejected — pick one mode.

### Response

```json
{
  "app_id": "56946887-f386-4b65-bb8c-a24df582ea24",
  "vendor_id": "965e38a5-46b6-403f-9e78-bb86911ef848",
  "version": "1.0",
  "status": "development",
  "verification": {
    "status": "ok",
    "errors": [],
    "warnings": []
  },
  "message": "App created and visible in your marketplace. An admin will review and publish it."
}
```

**Save the `app_id`** — you'll need it for updates.

Your app always lands in `development` status, even if verification fails. If there are issues, the `message` and `verification.errors` fields tell you what to fix:

```json
{
  "status": "development",
  "verification": {
    "status": "error",
    "errors": ["widgets.json fetch failed: Connection refused"]
  },
  "message": "App created and visible in your marketplace, but verification found issues. Fix these before requesting publish: widgets.json fetch failed: Connection refused"
}
```

## Step 2 — Preview Your App

Log in to the OpenBB frontend. Your app will appear in the marketplace — only visible to you. Other users won't see it.

Apps marked as development will show an `isDevelopment: true` flag in the API response.

## Step 3 — Update Your App

Fix descriptions, change thumbnails, update your backend URL — whatever you need:

```bash
curl -X PATCH https://payments.openbb.dev/marketplace/developer/apps/<APP_ID> \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"short_description": "Updated description"}'
```

You can update any of these fields:

`app_name`, `short_description`, `category`, `tagline`, `thumbnail_url`, `thumbnail_url_dark`, `thumbnail_url_light`, `media`, `api_key_url`, `api_key_info_url`, `more_information_url`, `backend_base_url`, `apps_json_url`, `widgets_json_url`, `auth_type`, `auth_fields`, `vendor_name`, `vendor_description`, `vendor_website_url`, `vendor_thumbnail_url`, `documentation_url`, `contact_email`

Switching `auth_type` from `["custom"]` to anything else clears any stored `auth_fields` automatically. Switching *to* `["custom"]` requires `auth_fields` in the same PATCH.

If you change `backend_base_url`, `apps_json_url`, or `widgets_json_url`, verification re-runs automatically.

**You cannot change `version`** — create a new version instead (see below).

## Step 4 — Create a New Version

Want to release an update? Create a new version:

```bash
curl -X POST https://payments.openbb.dev/marketplace/developer/apps \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_name": "Your Company Name",
    "app_name": "Your App Name",
    "version": "1.1",
    "short_description": "What this app does",
    "backend_base_url": "https://api.yourcompany.com/v2",
    "auth_type": ["api_key"]
  }'
```

You can have multiple versions in development at the same time. Only one version can be published at a time — when we publish a new version, the old one is automatically disabled.

## Step 5 — Remove an App

If you want to delete a development app (frees up an app slot):

```bash
curl -X DELETE https://payments.openbb.dev/marketplace/developer/apps/<APP_ID> \
  -H "Authorization: Bearer <YOUR_TOKEN>"
```

You can only remove apps in `development` status. Once an app is published, contact us to remove it.

## Step 6 — Request Publish

When your app is ready, message us with:

> **"[App Name] version [X.X] is ready to be published"**

We'll review the app, verify the manifests are working, and publish it to the marketplace.

If we find any issues, we'll let you know what needs to be fixed. Once fixed, update your backend and let us know — we'll re-verify and publish.

---

## Limits

- **5 apps** per developer (counted by app name, not versions)
- Once published, you **cannot** edit or remove the app — contact us for changes
- Vendor names are unique — if someone else already has that vendor name, choose a different one

## Manifest Requirements

Your backend must serve two JSON files:

### `widgets.json`

URL: `{backend_base_url}/widgets.json`

A JSON object where each key is a widget ID:

```json
{
  "stock_price_chart": {
    "name": "Stock Price Chart",
    "description": "Real-time stock price chart",
    "category": "stocks",
    "endpoint": "stock/price",
    "gridData": {"w": 20, "h": 9}
  },
  "market_overview": {
    "name": "Market Overview",
    "description": "Daily market summary",
    "category": "markets",
    "endpoint": "market/overview",
    "gridData": {"w": 40, "h": 9}
  }
}
```

### `apps.json`

URL: `{backend_base_url}/apps.json`

A JSON array of app configurations:

```json
[
  {
    "name": "Your App Name",
    "description": "App description",
    "img": "https://yourcompany.com/logo.png",
    "prompts": [
      "Analyze the latest stock price movement.",
      "Compare the top 3 sectors by performance."
    ]
  }
]
```

Both URLs must return valid JSON. If either is unreachable or returns invalid data, verification will fail — but your app will still be created in development mode so you can fix and iterate.

## Quick Reference

| Action | Method | Endpoint |
|---|---|---|
| Create app | `POST` | `/marketplace/developer/apps` |
| Update app | `PATCH` | `/marketplace/developer/apps/<APP_ID>` |
| Remove app | `DELETE` | `/marketplace/developer/apps/<APP_ID>` |
| Preview | `GET` | `/marketplace/apps` (with your auth token) |
