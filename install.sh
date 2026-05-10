#!/usr/bin/env sh
set -e

REPO="flying-dice/abtree"
BIN="abtree"

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
case "$OS" in
  linux)  ;;
  darwin) ;;
  *) echo "Unsupported OS: $OS" >&2; exit 1 ;;
esac

ARCH=$(uname -m)
case "$ARCH" in
  x86_64)        ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

ASSET="${BIN}-${OS}-${ARCH}"

# __ABTREE_VERSION__ is replaced at release time by .releaserc with the
# git tag (e.g. v1.2.3). When this script is fetched from main the
# placeholder is left untouched and we fall back to /releases/latest/.
VERSION="${ABTREE_VERSION:-__ABTREE_VERSION__}"
case "$VERSION" in
  __ABTREE_VERSION__|latest|"") URL_PATH="latest/download" ;;
  *) URL_PATH="download/${VERSION}" ;;
esac
URL="https://github.com/${REPO}/releases/${URL_PATH}/${ASSET}"

echo "Downloading ${ASSET}..."
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT
curl -fsSL "$URL" -o "$TMPFILE"
chmod +x "$TMPFILE"

INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
mkdir -p "$INSTALL_DIR"
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMPFILE" "${INSTALL_DIR}/${BIN}"
else
  echo "Writing to ${INSTALL_DIR} requires sudo..."
  sudo mv "$TMPFILE" "${INSTALL_DIR}/${BIN}"
fi

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) echo "Note: ${INSTALL_DIR} is not on your PATH — add it to your shell profile and restart your terminal." ;;
esac

echo "Installed: ${INSTALL_DIR}/${BIN}"
