# Marketplace Backend

## Overview

The marketplace allows third-party vendors to list apps (widget + prompt bundles) that users can subscribe to. Each app points to a backend that serves `widgets.json` and `apps.json` manifests.

### Models

- **Vendor** — a company/team that provides apps (has optional `owner_uuid` for developer ownership)
- **VendorApp** — an app listing with manifest URLs, verification state, cached data, `owner_uuid`, and `version`
- **UserAppSubscription** — tracks which users have subscribed to which apps

### App Lifecycle

```
submitted → verified → development → published → disabled → published (re-enable)
                     ↘ published (admin direct)            ↘ removed
```

| Status | Description |
|---|---|
| **submitted** | Initial state after creating an app |
| **verified** | Automatic verification passed (manifests reachable and valid) |
| **development** | Visible only to the app owner — for testing before publish |
| **published** | Visible to all users in `GET /marketplace/apps` |
| **disabled** | Temporarily hidden from public catalog |
| **removed** | Permanently hidden |

### Versioning

Each app has a `version` field (free-form string like `"1.0"`, `"1.1"`, `"2.0"`). The unique constraint is `(vendor_uuid, name, version)` — the same app name can have multiple versions.

- Only **one version** of a given app can be `published` at a time
- Publishing a new version auto-disables the previously published version
- To roll back: publish the older version again
- Versions don't count against the developer app limit (limit counts by distinct app name)

### Authentication

- `/admin/marketplace/*` endpoints require a **superuser** session token
- `/marketplace/developer/*` endpoints require a regular **user** session token (developer self-serve)
- Public endpoints work without auth, but authenticated users also see their own `development` apps

---

## Developer Self-Serve Endpoints

These endpoints let developers create, test, and manage their own marketplace apps without admin involvement. Apps created here land in `development` status — visible only to the developer.

### Restrictions

- **5-app limit** per developer (counted by distinct app name, not versions)
- Developers can only edit apps in `development`/`submitted`/`verified` status
- **Published and disabled apps are locked** — only a superadmin can edit them
- Developers can only edit vendors they own (auto-assigned on creation)
- Version is set at creation and cannot be changed (create a new version instead)

### Create vendor + app

```bash
curl -X POST https://payments.openbb.dev/marketplace/developer/apps \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_name": "Acme Data",
    "vendor_description": "Financial data provider",
    "vendor_website_url": "https://acmedata.com",
    "contact_email": "support@acmedata.com",
    "app_name": "Acme Markets",
    "version": "1.0",
    "short_description": "Real-time market data widgets",
    "thumbnail_url": "https://acmedata.com/logo.png",
    "backend_base_url": "https://api.acmedata.com",
    "auth_type": ["none"]
  }'
```

**Response (verification passed):**

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

**Response (verification failed — app is still created):**

```json
{
  "app_id": "...",
  "vendor_id": "...",
  "version": "1.0",
  "status": "development",
  "verification": {
    "status": "error",
    "errors": ["apps.json fetch failed: ...", "widgets.json fetch failed: ..."],
    "warnings": ["backend_base_url check failed: ..."]
  },
  "message": "App created and visible in your marketplace, but verification found issues. Fix these before requesting publish: ..."
}
```

Apps **always** land in `development` status regardless of verification — so developers can preview and iterate. The `message` field tells them what to fix. An admin cannot publish the app until verification passes (they can re-verify with `/admin/marketplace/apps/<APP_ID>/verify`).

### Create a new version of an existing app

```bash
curl -X POST https://payments.openbb.dev/marketplace/developer/apps \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_name": "Acme Data",
    "app_name": "Acme Markets",
    "version": "1.1",
    "short_description": "Updated market data widgets",
    "backend_base_url": "https://api.acmedata.com/v2",
    "auth_type": ["none"]
  }'
```

The developer can have v1.0 published and v1.1 in development at the same time.

### Update own app

```bash
curl -X PATCH https://payments.openbb.dev/marketplace/developer/apps/<APP_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"short_description": "Updated description"}'
```

Only works on apps in `development`/`submitted`/`verified` status. Published apps are locked.

**Updatable fields:** `app_name`, `short_description`, `thumbnail_url`, `thumbnail_url_dark`, `thumbnail_url_light`, `media`, `api_key_url`, `api_key_info_url`, `more_information_url`, `backend_base_url`, `apps_json_url`, `widgets_json_url`, `auth_type`, `vendor_name`, `vendor_description`, `vendor_website_url`, `vendor_thumbnail_url`, `documentation_url`, `contact_email`

**Not updatable:** `version`, `is_built_in`

### Remove own app

```bash
curl -X DELETE https://payments.openbb.dev/marketplace/developer/apps/<APP_ID> \
  -H "Authorization: Bearer <TOKEN>"
```

Only works on apps in `development`/`submitted`/`verified` status. Published apps cannot be removed by the developer.

---

## Admin Endpoints

### Publishing a Developer-Submitted App

This is the most common admin flow — a developer has created an app via the self-serve endpoint and it's in `development` status. The admin reviews and publishes it.

**1. List development apps waiting for review:**

```bash
curl "https://payments.openbb.dev/admin/marketplace/apps?status=development" \
  -H "Authorization: Bearer <TOKEN>"
```

Each app in the response includes `name`, `version`, and `status` so you can identify which version to publish.

**2. (Optional) Re-verify if the developer fixed issues:**

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/verify \
  -H "Authorization: Bearer <TOKEN>"
```

This re-checks the manifest URLs and refreshes cached data. Required if the app had verification errors.

**3. Publish the app:**

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/publish \
  -H "Authorization: Bearer <TOKEN>"
```

This works on apps in `verified` or `development` status. **If another version of the same app is already published, it will be auto-disabled.**

**4. Roll back to a previous version:**

The old version will be in `disabled` status. Re-enable it — this automatically disables the currently published version:

```bash
# Find the old version's app_id
curl "https://payments.openbb.dev/admin/marketplace/apps?status=disabled" \
  -H "Authorization: Bearer <TOKEN>"

# Re-enable it (auto-disables the current published version)
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<OLD_APP_ID>/enable \
  -H "Authorization: Bearer <TOKEN>"
```

---

### Creating Apps Directly (Admin)

> **TL;DR for returning vendors**
> - New vendor → [Step 2](#step-2--register-the-vendor-and-app) (creates vendor + app together)
> - Existing vendor, new app → [Add app to existing vendor](#adding-an-app-to-an-existing-vendor)
> - Updating an existing app (logo, description, URLs) → [Update app fields](#update-app-fields)

All `/admin/marketplace/*` endpoints require a **superuser** session token. Regular admin accounts are not sufficient.

### Step 1 — Get your superuser token

1. Log in to the frontend as a superuser
2. Open browser DevTools (`F12`)
3. Find your session token (look in network requests for the `Authorization: Bearer <TOKEN>` header, or in cookies/local storage)
4. Copy the token — you'll use it in every admin request below

### Step 2 — Register the vendor and app

This single request creates the vendor (or reuses an existing one by name) and the app in one call. Verification runs automatically.

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

**Field notes:**

| Field | Details |
|---|---|
| `vendor_name` | Upserts — if a vendor with this name already exists, it reuses it |
| `version` | Free-form string (e.g. `"1.0"`, `"2"`, `"beta"`). Defaults to `"1"` |
| `backend_base_url` | Auto-derives manifest URLs as `{base}/widgets.json` and `{base}/apps.json` unless you provide `apps_json_url` / `widgets_json_url` explicitly |
| `auth_type` | `"api_key"`, `"none"`, or both (e.g. `["api_key", "none"]`) |
| `is_built_in` | Set `true` for first-party apps (skips URL verification) |
| `media` | Image / video / YouTube URLs shown in the app detail carousel. Each URL is classified by the frontend: `youtube.com` or `youtu.be` → `<iframe>` embed, `.mp4`/`.webm`/`.mov`/`.m4v` → `<video>` with native controls, everything else → `<img>`. Accepted under the legacy name `screenshots` for backward compatibility. |
| `api_key_info_url` | Optional URL pointing to vendor documentation on how users can obtain an API key. Surfaced alongside the "Add API Key" modal so users have a direct link to signup / key-generation instructions. |
| `vendor_thumbnail_url` | Optional vendor-level logo (URL or base64). Used anywhere we display the vendor brand (separate from the per-app `thumbnail_url`). Persists on the vendor record, so it's shared across all of the vendor's apps. |

The response also includes `created_date` and `updated_date` (auto-populated, not settable). `created_date` is when the app was first submitted; `updated_date` is when any field was last modified or re-verification ran.

**Example response:**

```json
{
  "app_id": "56946887-f386-4b65-bb8c-a24df582ea24",
  "vendor_id": "965e38a5-46b6-403f-9e78-bb86911ef848",
  "version": "1.0",
  "status": "verified",
  "verification": {
    "status": "ok",
    "errors": [],
    "warnings": [
      "backend_base_url unreachable: 405",
      "thumbnail_url unreachable: 404",
      "api_key_url unreachable: 404"
    ],
    "manifest_summary": {
      "widgets_count": 5,
      "prompts_count": 0
    }
  }
}
```

> **Important:** Save the `app_id` from this response — you'll need it for every subsequent command.

If `verification.status` is `"ok"`, the app status moves to `"verified"` automatically. Warnings (like unreachable thumbnail URLs) won't block verification — only errors will.

### Step 3 — Publish to the marketplace

Once the app is verified (or in development), publish it to make it visible in the public catalog:

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/publish \
  -H "Authorization: Bearer <TOKEN>"
```

This works on apps in `verified` or `development` status. **If another version of the same app is already published, it will be auto-disabled.**

### Step 4 — Confirm it's live

Hit the public endpoint (no auth needed) to verify your app appears:

```bash
curl https://payments.openbb.dev/marketplace/apps
```

Your app should now be in the returned list.

---

## Adding an App to an Existing Vendor

If the vendor already exists, use their `vendor_id` (from the original creation response or from `GET /admin/marketplace/apps`) and submit only app fields — no vendor fields needed.

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/vendors/<VENDOR_ID>/apps \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "app_name": "Acme Analytics",
    "version": "1.0",
    "short_description": "Portfolio analytics widgets",
    "thumbnail_url": "https://acmedata.com/analytics-logo.png",
    "backend_base_url": "https://analytics.acmedata.com",
    "auth_type": ["api_key"]
  }'
```

Returns the same response as the combined create endpoint (`app_id`, `vendor_id`, `version`, `status`, `verification`).

---

## Re-verification

If verification failed on create (e.g. your manifests weren't deployed yet), fix the issue and re-run:

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/verify \
  -H "Authorization: Bearer <TOKEN>"
```

This also refreshes the cached manifest data (widget/prompt counts).

---

## Managing Published Apps

### List all apps (admin view, any status)

```bash
curl https://payments.openbb.dev/admin/marketplace/apps \
  -H "Authorization: Bearer <TOKEN>"

# Filter by status
curl "https://payments.openbb.dev/admin/marketplace/apps?status=published" \
  -H "Authorization: Bearer <TOKEN>"
```

The admin view includes `version` for each app, making it easy to identify which version is in which state.

### Disable (temporarily hide from catalog)

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/disable \
  -H "Authorization: Bearer <TOKEN>"
```

### Re-enable a disabled app

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/enable \
  -H "Authorization: Bearer <TOKEN>"
```

### Remove permanently

Works from any state — this cannot be undone.

```bash
curl -X POST https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/remove \
  -H "Authorization: Bearer <TOKEN>"
```

### Update app fields

All fields are optional — only send what you want to change. If `backend_base_url`, `apps_json_url`, or `widgets_json_url` change, re-verification runs automatically.

**Assign an owner (for developer self-serve access):**

```bash
curl -X PATCH https://payments.openbb.dev/admin/marketplace/apps/<APP_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"owner_email": "developer@acmedata.com"}'
```

**Update the app logo/thumbnail:**

```bash
curl -X PATCH https://payments.openbb.dev/admin/marketplace/apps/<APP_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"thumbnail_url": "https://acmedata.com/new-logo.png"}'
```

**Update description:**

```bash
curl -X PATCH https://payments.openbb.dev/admin/marketplace/apps/<APP_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"short_description": "Updated description"}'
```

**Update backend URL (triggers re-verification):**

```bash
curl -X PATCH https://payments.openbb.dev/admin/marketplace/apps/<APP_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"backend_base_url": "https://new-api.acmedata.com"}'
```

**Updatable fields:** `app_name`, `short_description`, `thumbnail_url`, `thumbnail_url_dark`, `thumbnail_url_light`, `media`, `api_key_url`, `api_key_info_url`, `more_information_url`, `backend_base_url`, `apps_json_url`, `widgets_json_url`, `is_built_in`, `auth_type`, `vendor_name`, `vendor_description`, `vendor_website_url`, `vendor_thumbnail_url`, `documentation_url`, `contact_email`, `owner_email`

---

## Public Endpoints

No auth required (but authenticated users also see their own `development` apps).

```bash
# List all published apps (+ own development apps if authenticated)
curl https://payments.openbb.dev/marketplace/apps

# Get a single published app (or own development app if authenticated)
curl https://payments.openbb.dev/marketplace/apps/<APP_ID>
```

The response includes `isDevelopment: true` for apps in development status.

Each app also includes a `widgets` array and a `total_widgets` count derived from the cached manifests. Only widgets that are actually referenced in a tab layout (i.e. `apps.json[].tabs[].layout[].i`) are included, and each entry shows how many times that widget is used across the app's layouts:

```json
{
  "widgets": [
    {
      "id": "stock_price_chart",
      "name": "Stock Price Chart",
      "description": "Real-time stock price chart",
      "count": 2
    },
    {
      "id": "market_overview",
      "name": "Market Overview",
      "description": "Daily market summary",
      "count": 1
    }
  ],
  "total_widgets": 3
}
```

`total_widgets` is the sum of all `count` values (total layout placements), not the number of distinct widget IDs. Widgets that exist in `widgets.json` but aren't referenced by any layout are excluded from the array.

---

## User Subscription Endpoints

Require a regular user session token. Users can subscribe to published apps and their own development apps.

```bash
# Subscribe to an app
curl -X POST https://payments.openbb.dev/marketplace/apps/<APP_ID>/subscribe \
  -H "Authorization: Bearer <TOKEN>"

# Unsubscribe (soft-delete, returns 204)
curl -X DELETE https://payments.openbb.dev/marketplace/apps/<APP_ID>/subscribe \
  -H "Authorization: Bearer <TOKEN>"

# List active subscriptions
curl https://payments.openbb.dev/marketplace/subscriptions \
  -H "Authorization: Bearer <TOKEN>"
```

### Admin subscription stats

```bash
curl https://payments.openbb.dev/admin/marketplace/apps/<APP_ID>/subscriptions \
  -H "Authorization: Bearer <TOKEN>"
```

Returns `active_count` and `total_count` for the app.

---

## Vendor App Manifest Requirements

The vendor's backend must serve two JSON files at `{backend_base_url}/widgets.json` and `{backend_base_url}/apps.json`.

### `widgets.json`

A JSON object where each key is a widget ID and the value is the widget config:

```json
{
  "widget_id_1": {
    "name": "Stock Price Chart",
    ...
  },
  "widget_id_2": {
    "name": "Market Overview",
    ...
  }
}
```

### `apps.json`

A JSON array where each entry can contain a `prompts` field:

```json
[
  {
    "name": "My App",
    "prompts": [
      {"name": "Analyze Stock", ...},
      {"name": "Compare Sectors", ...}
    ]
  }
]
```

Both URLs must be reachable (HEAD check) and return valid JSON (GET check) for verification to pass.

### MCP servers (`mcp_servers`)

An app entry in `apps.json` can also declare MCP servers. When present, the app's marketplace page in OpenBB Workspace surfaces a "Connect" action for the server:

```json
[
  {
    "name": "My App",
    "mcp_servers": [
      {
        "name": "Acme Research MCP",
        "description": "Query Acme research data via MCP tools.",
        "url": "https://mcp.acmedata.com/mcp",
        "authType": "token"
      }
    ]
  }
]
```

| Field | Details |
|---|---|
| `name` | Display name for the MCP server |
| `description` | Optional short description of what the server provides |
| `url` | The MCP server endpoint URL |
| `authType` | Optional — `"oauth"` (default) or `"token"`. With `"oauth"`, Workspace runs the standard MCP OAuth flow when the server returns a 401. With `"token"`, Workspace prompts the user for a static access token and sends it as an `Authorization: Bearer <token>` header on every request to that server; a 401 is treated as an invalid/expired token and never falls back to OAuth. |

The MCP server list is extracted from the first app entry in the cached `apps.json` and returned on the public marketplace endpoints as `mcp_servers`.

---

## Fresh Setup

```bash
# Wipe everything and rebuild
docker-compose down -v --remove-orphans
docker-compose up -d mysql
# Wait ~10s for MySQL to initialize, then:
docker-compose exec mysql mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS user_db;"
docker-compose up -d
```

Migrations run automatically on container start. After the backend is up, use the admin endpoints above to add vendors and apps.
