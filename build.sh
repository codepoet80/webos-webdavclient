#!/bin/bash

# Build script for WebDAV Client
#
# This script builds the IPK package with proper service registration.
# palm-package doesn't include postinst/prerm in the control archive,
# so we manually add them after initial packaging.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

APP_ID="com.aventer.webdavclient"
TEMP_DIR="/tmp/ipk_build_$$"

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
    "service/roles.json"
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

IPK_FILE="${APP_ID}_${VERSION}_all.ipk"

# Build package (service files are in app's service/ directory)
# The postinst script will copy them to /usr/palm/services/ and register D-BUS
echo "Running palm-package..."
palm-package .

if [ ! -f "$IPK_FILE" ]; then
    echo "ERROR: palm-package failed - IPK not created"
    exit 1
fi

# palm-package doesn't add postinst/prerm to control archive
# We need to manually inject them for webOS to run them on install
echo "Injecting postinst/prerm into package..."

mkdir -p "$TEMP_DIR"
cp "$IPK_FILE" "$TEMP_DIR/"
cd "$TEMP_DIR"

# Extract IPK (it's an ar archive)
ar -x "$IPK_FILE"

# Add scripts to control archive
tar -xzf control.tar.gz
cp "$SCRIPT_DIR/package/postinst" ./postinst
cp "$SCRIPT_DIR/package/prerm" ./prerm
chmod 755 ./postinst ./prerm
tar -czf control.tar.gz ./control ./postinst ./prerm

# Rebuild IPK
ar -r "$IPK_FILE" debian-binary control.tar.gz data.tar.gz

# Move final IPK back
mv "$IPK_FILE" "$SCRIPT_DIR/"
cd "$SCRIPT_DIR"
rm -rf "$TEMP_DIR"

echo ""
echo "Build successful: $IPK_FILE"
ls -lh "$IPK_FILE"

echo ""
echo "=== Build Complete ==="
echo ""
echo "Install using webOS Quick Install (not palm-install)"
