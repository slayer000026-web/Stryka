#!/bin/bash
# Stryka Android Build Script
# One-click APK generation

set -e

echo "🔱 Stryka Android Build Started..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Sync Capacitor
echo -e "${BLUE}→ Syncing Capacitor...${NC}"
npx cap sync android

# Step 2: Build APK
echo -e "${BLUE}→ Building debug APK...${NC}"
cd android
chmod +x gradlew 2>/dev/null || true
./gradlew assembleDebug

# Step 3: Find APK
APK=$(find . -name "*.apk" -type f 2>/dev/null | head -1)
if [ -f "$APK" ]; then
    echo -e "${GREEN}✅ APK Generated: $APK${NC}"
    cp "$APK" ../stryka-release.apk
    echo -e "${GREEN}✅ APK copied to: stryka-release.apk${NC}"
else
    echo "❌ APK build failed"
    exit 1
fi
