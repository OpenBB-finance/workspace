# OpenBB Lite — Installation Guide

## Prerequisites

- **Docker** installed and running ([Docker Desktop](https://www.docker.com/products/docker-desktop))
- **AWS CLI** installed ([installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
- **AWS credentials** provided by OpenBB (access key ID + secret access key)

You do not need an AWS account — the credentials provided only authorize pulling the OpenBB Lite container image.

---

## Step 1 — Configure your credentials

```bash
aws configure --profile openbb-lite-profile
```

Enter the credentials provided by OpenBB:

```
AWS Access Key ID: <your access key ID>
AWS Secret Access Key: <your secret access key>
Default region name: us-east-1
Default output format: json
```

---

## Step 2 — Log in to the registry

The token expires every 12 hours — re-run this if you get an authentication error.

```bash
aws ecr get-login-password --region us-east-1 --profile openbb-lite-profile | docker login --username AWS --password-stdin lite.openbb.co
```

Expected output: `Login Succeeded`

---

## Step 3 — Pull the image

```bash
docker pull lite.openbb.co/openbb-lite:latest
```

---

## Step 4 — Run OpenBB Lite

```bash
docker run -d -p 3000:3000 -v openbb-data:/data --name openbb lite.openbb.co/openbb-lite:latest
```

The `-v openbb-data:/data` volume stores your data and admin password so they survive restarts and upgrades.

Open your browser and go to `http://localhost:3000`.

---

## Step 5 — Get your admin login

```bash
docker exec openbb credentials
```

This prints your admin email and password. Use them to sign in at `http://localhost:3000`.

---

## Configuration (optional)

OpenBB Lite runs with sensible defaults, so this step is optional. If you want to
turn features on or off, pass environment variables with `-e` on the `docker run`
command. Settings are read once at container start — to change one, stop and remove
the container and run it again with the new value.

### Feature toggles

Each value is `true` or `false`.

| Variable | Default | What it controls |
| --- | --- | --- |
| `AI_COPILOT_ENABLED` | `true` | Master switch for the AI Copilot. Set `false` to remove AI entirely. |
| `AI_COPILOT_OPENBB_COPILOT` | `false` | Show the built-in OpenBB Copilot agent. |
| `AI_COPILOT_AI_ENHANCEMENTS` | `true` | AI-assisted enhancements across the app. |
| `UI_SHOW_COPILOT_SWITCHER` | `true` | Show the agent/copilot switcher dropdown. |
| `UI_SHOW_MARKETPLACE` | `true` | Show the marketplace. |
| `UI_SHOW_CHANGELOG` | `true` | Show the in-app changelog. |
| `UI_SHOW_CHART_GENERATION` | `true` | Enable chart generation. |
| `UI_SHOW_MINIMIZE_WIDGET` | `true` | Show the minimize button on widgets. |
| `UI_SHOW_COMPANION_MCP_MODE` | `true` | Show companion / MCP mode. |
| `MCP_DEFAULT_SERVER_ENABLED` | `true` | Enable the default MCP server. |
| `DATA_ALLOW_HTML_JS_EXECUTION` | `true` | Allow HTML/JS execution inside data widgets. |

### Example

Run with the OpenBB Copilot enabled and the marketplace hidden:

```bash
docker run -d -p 3000:3000 -v openbb-data:/data --name openbb \
  -e AI_COPILOT_OPENBB_COPILOT=true \
  -e UI_SHOW_MARKETPLACE=false \
  lite.openbb.co/openbb-lite:latest
```

### Advanced — service URLs

These usually don't need changing. Set them only if you run OpenBB Lite behind a
proxy or point it at external services.

| Variable | Default | What it controls |
| --- | --- | --- |
| `BACKEND_URL` | `/api` | Base URL for the backend API. |
| `AI_API_URL` | *(empty)* | AI service URL. |
| `PLATFORM_URL` | *(empty)* | Platform service URL. |
| `DATABASE_API_URL` | *(empty)* | Database API URL. |
| `AUTHENTICATION_SEND_USER_EMAIL_AS_HEADER` | `false` | Forward the signed-in user's email as a request header (for proxy-based auth). |

> These settings adjust the interface and client-side behavior. They are not a
> security boundary — anything that must be strictly enforced is handled by the
> backend.

---

## Updating to a newer version

Your data and admin password live in the `openbb-data` volume, so they survive the upgrade. The explicit `docker pull` is required — Docker reuses the locally cached `latest` otherwise.

```bash
docker stop openbb && docker rm openbb
aws ecr get-login-password --region us-east-1 --profile openbb-lite-profile | docker login --username AWS --password-stdin lite.openbb.co
docker pull lite.openbb.co/openbb-lite:latest
docker run -d -p 3000:3000 -v openbb-data:/data --name openbb lite.openbb.co/openbb-lite:latest
```

---

## Troubleshooting

**`Login Succeeded` but `docker pull` fails with `denied`**
Your credentials do not have access to this repository. Contact OpenBB support.

**`Error response from daemon: no matching manifest for linux/arm64`**
Add `--platform linux/amd64` to the pull and run commands:
```bash
docker pull --platform linux/amd64 lite.openbb.co/openbb-lite:latest
docker run --platform linux/amd64 -d -p 3000:3000 -v openbb-data:/data --name openbb lite.openbb.co/openbb-lite:latest
```

**Port 3000 is already in use**
Map a different host port — for example `-p 8080:3000` (then visit `http://localhost:8080`). The container always listens on 3000 internally.

**Authentication error after 12 hours**
ECR login tokens expire every 12 hours. Re-run the login command from Step 2.
