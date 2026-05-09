#!/usr/bin/env sh
set -e

REPO="flying-dice/abtree"
BIN="abt"

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
URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"

echo "Downloading ${ASSET}..."
curl -fsSL "$URL" -o "/tmp/${BIN}"
chmod +x "/tmp/${BIN}"

INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
if [ -w "$INSTALL_DIR" ]; then
  mv "/tmp/${BIN}" "${INSTALL_DIR}/${BIN}"
else
  echo "Writing to ${INSTALL_DIR} requires sudo..."
  sudo mv "/tmp/${BIN}" "${INSTALL_DIR}/${BIN}"
fi

echo "Installed: $(command -v ${BIN})"
