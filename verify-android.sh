#!/bin/bash

echo "🔍 Starting Android Project Verification..."

# Check for required folders
echo -e "\n✅ Checking directory structure:"
REQUIRED_PATHS=(
  "android"
  "android/app"
  "android/app/src/main/res"
  "android/app/src/main/java/com/healthnotelabs/dietstr"
  "android/app/src/main/assets"
  "android/capacitor.settings.gradle"
  "android/app/capacitor.build.gradle"
)

MISSING_PATHS=0
for path in "${REQUIRED_PATHS[@]}"; do
  if [ -d "$path" ] || [ -f "$path" ]; then
    echo "  ✓ $path"
  else
    echo "  ✗ $path (missing)"
    MISSING_PATHS=$((MISSING_PATHS+1))
  fi
done

# Check capacitor.config.ts
echo -e "\n✅ Checking Capacitor configuration:"
if [ -f "capacitor.config.ts" ]; then
  echo "  ✓ capacitor.config.ts exists"
  APP_ID=$(grep "appId:" capacitor.config.ts | head -1 | sed "s/.*appId: '\(.*\)',/\1/")
  APP_NAME=$(grep "appName:" capacitor.config.ts | head -1 | sed "s/.*appName: '\(.*\)',/\1/")
  WEB_DIR=$(grep "webDir:" capacitor.config.ts | head -1 | sed "s/.*webDir: '\(.*\)',/\1/")
  
  echo "  ✓ Application ID: $APP_ID"
  echo "  ✓ Application Name: $APP_NAME"
  echo "  ✓ Web Directory: $WEB_DIR"
  
  if grep -q "plugins: {" capacitor.config.ts; then
    echo "  ✓ Plugins are configured"
  else
    echo "  ⚠️ No plugins configured in capacitor.config.ts"
  fi
else
  echo "  ✗ capacitor.config.ts does not exist"
  MISSING_PATHS=$((MISSING_PATHS+1))
fi

# Check MainActivity.java
echo -e "\n✅ Checking MainActivity.java:"
MAIN_ACTIVITY="android/app/src/main/java/com/healthnotelabs/dietstr/MainActivity.java"
if [ -f "$MAIN_ACTIVITY" ]; then
  echo "  ✓ MainActivity.java exists"
  
  if grep -q "BridgeActivity" "$MAIN_ACTIVITY"; then
    echo "  ✓ Extends BridgeActivity"
  else
    echo "  ✗ Does not extend BridgeActivity"
  fi
  
  if grep -q "onCreate" "$MAIN_ACTIVITY"; then
    echo "  ✓ Contains onCreate method"
  else
    echo "  ⚠️ No onCreate method found"
  fi
else
  echo "  ✗ MainActivity.java does not exist"
  MISSING_PATHS=$((MISSING_PATHS+1))
fi

# Check AndroidManifest.xml
echo -e "\n✅ Checking AndroidManifest.xml:"
MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  echo "  ✓ AndroidManifest.xml exists"
  
  if grep -q 'android:name=".MainActivity"' "$MANIFEST"; then
    echo "  ✓ MainActivity is properly declared"
  else
    echo "  ✗ MainActivity is not properly declared"
  fi
  
  if grep -q "android.permission.INTERNET" "$MANIFEST"; then
    echo "  ✓ Internet permission is declared"
  else
    echo "  ⚠️ Internet permission is missing"
  fi
else
  echo "  ✗ AndroidManifest.xml does not exist"
  MISSING_PATHS=$((MISSING_PATHS+1))
fi

# Check app icons
echo -e "\n✅ Checking Android app icons:"
ICON_DIRS=(
  "android/app/src/main/res/mipmap-hdpi"
  "android/app/src/main/res/mipmap-mdpi"
  "android/app/src/main/res/mipmap-xhdpi"
  "android/app/src/main/res/mipmap-xxhdpi"
  "android/app/src/main/res/mipmap-xxxhdpi"
)

for dir in "${ICON_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    ICON_COUNT=$(find "$dir" -name "ic_launcher*" | wc -l)
    echo "  ✓ $dir: $ICON_COUNT icon files"
  else
    echo "  ✗ $dir does not exist"
  fi
done

# Check dist directory
echo -e "\n✅ Checking dist directory (web build):"
if [ -d "dist/public" ]; then
  PUBLIC_COUNT=$(find "dist/public" -type f | wc -l)
  echo "  ✓ dist/public contains approximately $PUBLIC_COUNT items"
  
  if [ -d "dist/public/assets" ]; then
    ASSETS_COUNT=$(find "dist/public/assets" -type f | wc -l)
    JS_COUNT=$(find "dist/public/assets" -name "*.js" | wc -l)
    CSS_COUNT=$(find "dist/public/assets" -name "*.css" | wc -l)
    echo "  ✓ dist/public/assets contains $ASSETS_COUNT files"
    echo "  ✓ Assets include $JS_COUNT JS files and $CSS_COUNT CSS files"
  else
    echo "  ✗ dist/public/assets does not exist"
  fi
else
  echo "  ✗ dist/public does not exist"
fi

# Check Android assets
echo -e "\n✅ Checking Android assets directory:"
if [ -d "android/app/src/main/assets/public" ]; then
  ANDROID_ASSETS_COUNT=$(find "android/app/src/main/assets/public" -type f | wc -l)
  echo "  ✓ Android assets directory contains approximately $ANDROID_ASSETS_COUNT items"
  
  if [ -f "android/app/src/main/assets/capacitor.config.json" ]; then
    echo "  ✓ Capacitor config exists in Android assets"
  else
    echo "  ✗ Capacitor config missing from Android assets"
  fi
else
  echo "  ✗ Android assets directory does not exist"
fi

# Summary
echo -e "\n🎯 Verification Summary:"
if [ $MISSING_PATHS -eq 0 ]; then
  echo "  ✅ Directory structure is correct"
else
  echo "  ⚠️ Missing $MISSING_PATHS required directories/files"
fi

# Indicate build readiness
echo -e "\n🚀 Android Project Status:"
if [ $MISSING_PATHS -eq 0 ]; then
  echo "  ✅ Android project is ready for deployment!"
  echo "  📱 To build and run on an Android device:"
  echo "     1. Open Android Studio with: npx cap open android"
  echo "     2. Connect your device or use an emulator"
  echo "     3. Click \"Run\" in Android Studio"
else
  echo "  ⚠️ Android project needs attention before deployment"
fi

echo -e "\n🔍 Verification complete!"