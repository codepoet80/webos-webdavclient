#!/bin/bash

# Build script for WebDAV Client
# Usage: ./build.sh [install]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

APP_ID="com.aventer.webdavclientlite"

echo "=== WebDAV Client Build ==="

# Clean old build artifacts
echo "Cleaning old builds..."
rm -f *.ipk

# Validate required files
echo "Validating project structure..."
REQUIRED_FILES=(
    "appinfo.json"
    "index.html"
    "depends.js"
    "source/webdav.js"
    "source/webdav-service.js"
    "service/webdav-assistant.js"
    "service/commandline.js"
    "service/services.json"
    "service/sources.json"
    "service/dbus"
    "package/packageinfo.json"
    "package/postinst"
    "package/prerm"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "ERROR: Missing required file: $file"
        exit 1
    fi
done
echo "All required files present."

# Get version from appinfo.json
VERSION=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' appinfo.json | cut -d'"' -f4)
echo "Building version: $VERSION"

# Build package
echo "Running palm-package..."
palm-package .

IPK_FILE="${APP_ID}_${VERSION}_all.ipk"

if [ -f "$IPK_FILE" ]; then
    echo "Build successful: $IPK_FILE"
    ls -lh "$IPK_FILE"
else
    echo "ERROR: Build failed - IPK not created"
    exit 1
fi

# Install if requested
if [ "$1" = "install" ]; then
    echo ""
    echo "Installing to device..."
    palm-install "$IPK_FILE"
    echo "Installation complete."
fi

echo ""
echo "=== Build Complete ==="
