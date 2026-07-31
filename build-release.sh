#!/bin/bash
# Stryka Release Script
# Generates release APK and deployment artifacts

set -e

VERSION=${1:-"1.0.0"}
DATE=$(date +%Y%m%d)

echo "🔱 Stryka Release v$VERSION"

# Clean previous builds
rm -rf dist/
mkdir -p dist

# Build Android
echo "→ Building Android APK..."
./build-apk.sh

# Copy release files
cp stryka-release.apk "dist/stryka-v$VERSION-$DATE.apk"

# Create release notes
cat > "dist/release-notes-v$VERSION.txt" << NOTES
Stryka v$VERSION Release Notes
Date: $(date)
Platforms: Android (APK)

Changelog:
- UI improvements
- Performance optimizations
- Bug fixes

Download the APK from this directory.
NOTES

echo "✅ Release artifacts in dist/"
ls -la dist/
