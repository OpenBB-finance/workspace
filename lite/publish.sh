#!/usr/bin/env bash
# Build the OpenBB Lite image for amd64 + arm64 and push to GHCR.
#
# For most publishing, prefer the GitHub Actions workflow (.github/workflows/
# build.yml). This script is the local equivalent: it assembles the build
# context (backend from openbb-hub, frontend from terminalpro) and pushes a
# multi-arch image.
#
# Usage:
#   ./publish.sh                # uses ./VERSION, both sources @ develop
#   ./publish.sh 0.2.0          # explicit version
#
# Auth (pick one):
#   - Set CR_PAT (GitHub PAT with write:packages) + GHCR_USER before running.
#   - Or run `docker login ghcr.io` manually beforehand.
#
# Override target / sources via env:
#   REGISTRY=ghcr.io  ORG=openbb-finance  IMAGE=lite
#   PLATFORMS=linux/amd64,linux/arm64
#   HUB_REF=develop   TP_REF=develop      (branch, tag, SHA, or refs/pull/<N>/head)
#
# Re-running is safe — buildx caches layers and QEMU binfmt registration is
# idempotent.
set -euo pipefail

REGISTRY="${REGISTRY:-ghcr.io}"
ORG="${ORG:-openbb-finance}"
IMAGE="${IMAGE:-lite}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"
BUILDER="${BUILDER:-openbb-builder}"
HUB_REF="${HUB_REF:-develop}"
TP_REF="${TP_REF:-develop}"
HUB_REPO="${HUB_REPO:-https://github.com/OpenBB-finance/openbb-hub.git}"
TP_REPO="${TP_REPO:-https://github.com/OpenBB-finance/terminalpro.git}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
REPO_ROOT="$SCRIPT_DIR"
DOCKERFILE="Dockerfile"
VERSION_FILE="$SCRIPT_DIR/VERSION"

# --- resolve version ---------------------------------------------------------
VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  if [[ -f "$VERSION_FILE" ]]; then
    VERSION="$(tr -d '[:space:]' < "$VERSION_FILE")"
  else
    echo "ERROR: no version given and $VERSION_FILE is missing." >&2
    echo "  Pass one explicitly:  ./publish.sh 0.1.0" >&2
    echo "  Or create the file:   echo 0.1.0 > VERSION" >&2
    exit 1
  fi
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+a-zA-Z0-9.]+)?$ ]]; then
  echo "ERROR: '$VERSION' doesn't look like a semver version." >&2
  exit 1
fi

IMAGE_BASE="$REGISTRY/$ORG/$IMAGE"

echo ""
echo "==============================================================="
echo "  Publishing $IMAGE_BASE"
echo "    version:   $VERSION"
echo "    platforms: $PLATFORMS"
echo "    context:   $REPO_ROOT"
echo "==============================================================="
echo ""

# --- auth (optional non-interactive login) -----------------------------------
if [[ -n "${CR_PAT:-}" ]]; then
  : "${GHCR_USER:?GHCR_USER must be set when CR_PAT is set (your GitHub username).}"
  echo "[publish] Logging into $REGISTRY as $GHCR_USER..."
  echo "$CR_PAT" | docker login "$REGISTRY" -u "$GHCR_USER" --password-stdin
fi

# --- buildx builder ----------------------------------------------------------
if ! docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
  echo "[publish] Creating buildx builder '$BUILDER'..."
  docker buildx create --name "$BUILDER" --driver docker-container --use >/dev/null
else
  echo "[publish] Using existing buildx builder '$BUILDER'."
  docker buildx use "$BUILDER" >/dev/null
fi

# --- QEMU emulators (no-op if already installed) -----------------------------
echo "[publish] Registering QEMU binfmt handlers..."
docker run --rm --privileged tonistiigi/binfmt --install all >/dev/null

# --- assemble build context --------------------------------------------------
cd "$REPO_ROOT"

fetch_ref() { # <repo-url> <ref> <dest>
  git init -q "$3"
  git -C "$3" remote add origin "$1"
  git -C "$3" fetch -q --depth 1 origin "$2"
  git -C "$3" checkout -q FETCH_HEAD
}

echo "[publish] Assembling context — backend@$HUB_REF, frontend@$TP_REF..."
rm -rf backend terminalpro _hub
fetch_ref "$TP_REPO" "$TP_REF" terminalpro
fetch_ref "$HUB_REPO" "$HUB_REF" _hub
mv _hub/backend ./backend
rm -rf _hub

# --- build + push ------------------------------------------------------------
echo "[publish] Building and pushing $IMAGE_BASE:{$VERSION,latest}..."
docker buildx build \
  --platform "$PLATFORMS" \
  -f "$DOCKERFILE" \
  -t "$IMAGE_BASE:$VERSION" \
  -t "$IMAGE_BASE:latest" \
  --push \
  .

echo ""
echo "==============================================================="
echo "  Published $IMAGE_BASE:$VERSION"
echo "  Updated   $IMAGE_BASE:latest"
echo "==============================================================="
echo ""
echo "Inspect: docker buildx imagetools inspect $IMAGE_BASE:$VERSION"
echo "Pull:    docker pull $IMAGE_BASE:latest"
