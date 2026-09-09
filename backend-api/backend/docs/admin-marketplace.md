# Marketplace Admin Guide

Internal guide for publishing and managing marketplace apps.

All `/admin/marketplace/*` endpoints require a **superuser** session token.

## Getting Your Token

1. Log in to the frontend as a superuser
2. Open browser DevTools (`F12`)
3. Find your session token in network requests (`Authorization: Bearer <TOKEN>`)

---

## Publishing a Developer's App

The most common flow. A developer has submitted an app — it's in `development` status.

### 1. List apps waiting for review

```bash
curl "https://payments.openbb.dev/admin/marketplace/apps?status=development" \
  -H "Authorization: Bearer <TOKEN>"
```

Each version is a separate entry with its own `id`. If a developer submitted v1.0 and v1.2, you'll see both:

```json
[
  {
    "id": "77f0acf2-...",
    "name": "Acme Markets",
    "version": "1.0",
    "status": "development"
  },
  {
    "id": "84f8abda-...",
    "name": "Acme Markets",
    "version": "1.2",
    "status": "development"
  }
]
```

Find the version the developer asked you to publish and use its `id` in the next steps.

### 2. Verify the app

Re-run verification to make sure manifests are reachable and valid:

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/verify \
  -H "Authorization: Bearer <TOKEN>"
```

Check the response — `verification.status` should be `"ok"`. If there are errors, tell the developer to fix them.

### 3. Publish

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/publish \
  -H "Authorization: Bearer <TOKEN>"
```

The app must be in `verified` or `development` status.

**If another version of the same app is already published, it gets auto-disabled.** Only one version is live at a time.

### 4. Confirm it's live

```bash
curl https://payments.openbb.dev/marketplace/apps
```

The app should now appear in the public list.

---

## Rolling Back a Version

If a published version has issues, roll back to the previous one:

```bash
# Find the old version (it'll be in "disabled" status)
curl "https://payments.openbb.dev/admin/marketplace/apps?status=disabled" \
  -H "Authorization: Bearer <TOKEN>"

# Re-enable it (auto-disables the current published version)
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<OLD_APP_ID>/enable \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Creating Apps Directly (Without Developer)

If the developer hasn't used the self-serve flow, you can create the vendor + app yourself.

### Create vendor + app

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_name": "Acme Data",
    "vendor_description": "Financial data provider",
    "vendor_website_url": "https://acmedata.com",
    "vendor_thumbnail_url": "https://acmedata.com/vendor-logo.png",
    "documentation_url": "https://docs.acmedata.com",
    "contact_email": "support@acmedata.com",
    "app_name": "Acme Markets",
    "version": "1.0",
    "short_description": "Real-time market data widgets",
    "category": "Real-time Data & Analytics",
    "tagline": "Keep a pulse on the markets with Acme's real-time data widgets.",
    "thumbnail_url": "https://acmedata.com/logo.png",
    "thumbnail_url_dark": "https://acmedata.com/logo-dark.png",
    "thumbnail_url_light": "https://acmedata.com/logo-light.png",
    "media": [
      "https://acmedata.com/screenshot1.png",
      "https://acmedata.com/walkthrough.mp4"
    ],
    "api_key_url": "https://acmedata.com/verify-key",
    "api_key_info_url": "https://acmedata.com/docs/api-keys",
    "more_information_url": "https://acmedata.com/about",
    "backend_base_url": "https://api.acmedata.com",
    "is_built_in": false,
    "auth_type": ["none"]
  }'
```

| Field | Notes |
|---|---|
| `vendor_name` | Upserts — reuses existing vendor if name matches |
| `version` | Free-form string. Defaults to `"1"` |
| `app_name` | Display name shown to users. **Overrides `name` in the vendor's `apps.json`.** |
| `short_description` | Marketplace tile copy. **Overrides `description` in the vendor's `apps.json`.** |
| `category` | Optional category shown above the app name in the marketplace. |
| `tagline` | Optional one-liner shown in the marketplace under the app name. |
| `thumbnail_url` | Default app thumbnail. URL or base64. **Overrides `img` in the vendor's `apps.json`.** |
| `thumbnail_url_dark` | Optional dark-mode thumbnail. URL or base64. Overrides `img_dark`. Falls back to `thumbnail_url` if unset. |
| `thumbnail_url_light` | Optional light-mode thumbnail. URL or base64. Overrides `img_light`. Falls back to `thumbnail_url` if unset. |
| `media` | URLs shown in the app detail carousel (`MediaCarousel` frontend component). Each URL is classified independently: `youtube.com` / `youtu.be` → `<iframe>` embed, `.mp4`/`.webm`/`.mov`/`.m4v` → `<video>` with native controls, everything else → `<img>`. Accepted under the legacy name `screenshots` as well. See [Media carousel](#media-carousel) below. |
| `api_key_url` | Endpoint we POST user-entered API keys to for verification. If unset, we fall back to calling the first widget in `widgets.json`. See [API Key Verification](#api-key-verification) below. |
| `backend_base_url` | Auto-derives `widgets.json` and `apps.json` URLs |
| `is_built_in` | `true` for first-party apps (skips URL verification) |
| `auth_type` | Array of `"none"`, `"api_key"`, or `"custom"`. Allowed combinations: `["none"]`, `["api_key"]`, `["custom"]`, `["none", "api_key"]`, `["none", "custom"]`. **`["api_key", "custom"]` is rejected.** |
| `auth_fields` | Required when `auth_type` includes `"custom"`. Vendor-defined header fields rendered in the connect modal. See [Custom Auth Fields](#custom-auth-fields) below. |
| `api_key_info_url` | Optional URL to the vendor's docs on how to obtain an API key. Surfaced next to the "Add API Key" modal so users can click straight through to signup / key-generation instructions. Complements `api_key_url` (which we POST keys to for verification). |
| `vendor_thumbnail_url` | Optional vendor-level logo (URL or base64), stored on the vendor record. Use this when we want to show the vendor brand independently of the per-app `thumbnail_url` (shared across all apps from the same vendor). |
| `owner_email` | Optional — assign ownership to a developer by email |

The response also includes `created_date` and `updated_date` (auto-populated, not settable). `created_date` is when the app was first submitted; `updated_date` is when any field was last modified or re-verification ran.

### Override semantics

The `app_name`, `short_description`, `category`, `thumbnail_url`, `thumbnail_url_dark`, and `thumbnail_url_light` fields are **admin-controlled overrides**. Whatever value we set here is what users see in the marketplace and inside the Workspace — even if the vendor ships different values in their `apps.json`.

This is intentional: it means we can approve a specific listing look (name, copy, logo) and it stays locked in, independent of what the vendor pushes to their manifest. The rest of `apps.json` (tabs, widgets, prompts, groups) continues to flow through from the manifest as-is.

### Media carousel

The `media` array feeds the Workspace's `MediaCarousel` component on the app detail page. Each URL is classified independently at render time — there's no type metadata, and the backend doesn't validate or fetch the URLs:

| URL pattern | Renders as | Example |
|---|---|---|
| `youtube.com/*` or `youtu.be/*` | `<iframe>` embed | `https://www.youtube.com/watch?v=abc123` |
| `.mp4` / `.webm` / `.mov` / `.m4v` extension | `<video>` with native controls | `https://example.com/demo.mp4` |
| Everything else | `<img>` | `https://example.com/screenshot.png` |

Developers can mix types freely. Things to check when reviewing:

- **Broken or private URLs**: the backend does not HEAD-check `media` items, so a 404 or CORS-blocked asset will only be visible when you open the app in the Workspace. If you're approving an app, click through to the detail page and confirm every carousel item actually loads.
- **Self-hosted videos**: must be a direct `.mp4`/`.webm`/`.mov`/`.m4v` file URL. A page URL that returns HTML (e.g. a Vimeo watch page) will be mis-classified as an image and render as a broken placeholder.
- **CORS on videos**: self-hosted video files must be served with `Access-Control-Allow-Origin` headers the Workspace origin can use, otherwise playback silently fails.
- **YouTube share links**: both `youtube.com/watch?v=...` and `youtu.be/...` are accepted. The carousel converts them to the embed form internally — developers don't need to pre-format.
- **Legacy alias**: the same field is also accepted under the old name `screenshots` on request bodies and still emitted under that key on response bodies for backward compatibility. Prefer `media` in any new PATCH.

### API Key Verification

When a user adds an app that requires a key, we need to verify the key before saving it. There are two modes, picked per-app:

- **`api_key_url` is set** — we POST the user-provided key to that URL and expect a success/error response. The vendor fully controls the verification flow and can return a custom error message that's shown directly in the "Add API Key" modal.
- **`api_key_url` is not set** — we verify by calling the first widget in the vendor's `widgets.json` with the key. Whatever error message that widget returns on an invalid key is what the user sees in the modal.

When reviewing a new app, confirm with the developer which mode they intended. If they're relying on the widget fallback, sanity-check that the first widget returns a clear, user-facing error string on auth failure — not a stack trace or generic 401.

### Custom Auth Fields

Use `auth_type: ["custom"]` (or `["none", "custom"]` for optional auth) when the vendor needs one or more named headers that don't fit the default `api_key` flow. The Workspace renders one input per `auth_fields` entry in the connect modal and sends each value as the named header on every backend request.

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

Each item:

- `id` — stable form key. Must be unique across the array.
- `label` — user-facing field label shown in the modal.
- `key` — HTTP header name sent on backend requests. Must be unique across the array.
- `prefix` — optional string prepended to the user-entered value (e.g. `"Bearer "`).

Rules to enforce when reviewing:

- All fields are required at connect time — there's no per-field optional flag yet.
- Field order is preserved and reflected in the modal — confirm with the developer that the order makes sense.
- `["api_key", "custom"]` is invalid; pick one. If the vendor needs anonymous + custom, use `["none", "custom"]`.
- Don't use `["none", "custom"]` with a single field that just maps to `Authorization: Bearer ...` — that's exactly what `["api_key"]` (or `["none", "api_key"]`) is for. `custom` is for the cases the default flow can't express.

**Response:**

```json
{
  "app_id": "56946887-f386-4b65-bb8c-a24df582ea24",
  "vendor_id": "965e38a5-46b6-403f-9e78-bb86911ef848",
  "version": "1.0",
  "status": "verified",
  "verification": { "status": "ok", "errors": [], "warnings": [] }
}
```

Save the `app_id`. Then publish:

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/publish \
  -H "Authorization: Bearer <TOKEN>"
```

### Add app to existing vendor

If the vendor already exists, use their `vendor_id`:

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/vendors/<VENDOR_ID>/apps \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Acme Analytics",
    "version": "1.0",
    "short_description": "Portfolio analytics widgets",
    "backend_base_url": "https://analytics.acmedata.com",
    "auth_type": ["api_key"]
  }'
```

### Assign ownership to a developer

So a developer can manage the app via the self-serve endpoints:

```bash
curl -X PATCH https://payments.openbb.dev/admin/marketplace/apps/<APP_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"owner_email": "developer@acmedata.com"}'
```

---

## Managing Published Apps

### List all apps

```bash
# All apps
curl https://payments.openbb.dev/admin/marketplace/apps \
  -H "Authorization: Bearer <TOKEN>"

# Filter by status
curl "https://payments.openbb.dev/admin/marketplace/apps?status=published" \
  -H "Authorization: Bearer <TOKEN>"
```

### Update app fields

All fields are optional. If `backend_base_url`, `apps_json_url`, or `widgets_json_url` change, re-verification runs automatically.

```bash
curl -X PATCH https://payments.openbb.dev/admin/marketplace/apps/<APP_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"short_description": "Updated description"}'
```

**Updatable fields:** `app_name`, `short_description`, `category`, `tagline`,  `thumbnail_url`, `thumbnail_url_dark`, `thumbnail_url_light`, `media`, `api_key_url`, `api_key_info_url`, `more_information_url`, `backend_base_url`, `apps_json_url`, `widgets_json_url`, `is_built_in`, `auth_type`, `auth_fields`, `vendor_name`, `vendor_description`, `vendor_website_url`, `vendor_thumbnail_url`, `documentation_url`, `contact_email`, `owner_email`

> Switching `auth_type` away from `custom` (e.g. `["custom"]` → `["api_key"]`) clears any stored `auth_fields` automatically. Switching *to* `custom` requires `auth_fields` in the same PATCH.

### Disable (temporarily hide)

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/disable \
  -H "Authorization: Bearer <TOKEN>"
```

### Re-enable

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/enable \
  -H "Authorization: Bearer <TOKEN>"
```

### Remove permanently

Works from any status:

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/remove \
  -H "Authorization: Bearer <TOKEN>"
```

### Re-verify

Refresh manifest cache and re-check URLs:

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/verify \
  -H "Authorization: Bearer <TOKEN>"
```

---

## Subscription Stats

```bash
curl https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/subscriptions \
  -H "Authorization: Bearer <TOKEN>"
```

Returns `active_count` and `total_count`.

---

## Quick Reference

| Action | Method | Endpoint |
|---|---|---|
| List all apps | `GET` | `/admin/marketplace/apps` |
| List by status | `GET` | `/admin/marketplace/apps?status=development` |
| Create vendor + app | `POST` | `/admin/marketplace/apps` |
| Add app to vendor | `POST` | `/admin/marketplace/vendors/<VENDOR_ID>/apps` |
| Update app | `PATCH` | `/admin/marketplace/apps/<APP_ID>` |
| Publish | `POST` | `/admin/marketplace/apps/<APP_ID>/publish` |
| Disable | `POST` | `/admin/marketplace/apps/<APP_ID>/disable` |
| Re-enable | `POST` | `/admin/marketplace/apps/<APP_ID>/enable` |
| Remove | `POST` | `/admin/marketplace/apps/<APP_ID>/remove` |
| Re-verify | `POST` | `/admin/marketplace/apps/<APP_ID>/verify` |
| Subscription stats | `GET` | `/admin/marketplace/apps/<APP_ID>/subscriptions` |
