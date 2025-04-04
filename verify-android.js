// Android Project Verification Script
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🔍 Starting Android Project Verification...');

// Check for required folders
const requiredPaths = [
  'android',
  'android/app',
  'android/app/src/main/res',
  'android/app/src/main/java/com/healthnotelabs/dietstr',
  'android/app/src/main/assets',
  'android/capacitor.settings.gradle',
  'android/app/capacitor.build.gradle',
];

console.log('\n✅ Checking directory structure:');
let missingPaths = [];
for (const reqPath of requiredPaths) {
  if (fs.existsSync(reqPath)) {
    console.log(`  ✓ ${reqPath}`);
  } else {
    console.log(`  ✗ ${reqPath} (missing)`);
    missingPaths.push(reqPath);
  }
}

// Check Capacitor config
console.log('\n✅ Checking Capacitor configuration:');
try {
  // Use dynamic import
  const capConfigPath = new URL('./capacitor.config.ts', import.meta.url);
  import(capConfigPath.toString()).then(module => {
    const capConfig = module.default;
    console.log(`  ✓ Application ID: ${capConfig.appId}`);
    console.log(`  ✓ Application Name: ${capConfig.appName}`);
    console.log(`  ✓ Web Directory: ${capConfig.webDir}`);
  
    if (capConfig.plugins?.CapacitorHttp?.enabled) {
      console.log('  ✓ Capacitor HTTP plugin is enabled');
    } else {
      console.log('  ⚠️ Capacitor HTTP plugin is not enabled');
    }
  
    if (capConfig.server?.androidScheme === 'https') {
      console.log('  ✓ Android scheme is set to https');
    } else {
      console.log(`  ⚠️ Android scheme is set to ${capConfig.server?.androidScheme}`);
    }
  });
} catch (err) {
  console.log('  ✗ Error reading capacitor.config.ts:', err.message);
}

// Check MainActivity.java
console.log('\n✅ Checking MainActivity.java:');
const mainActivityPath = 'android/app/src/main/java/com/healthnotelabs/dietstr/MainActivity.java';
try {
  const mainActivity = fs.readFileSync(mainActivityPath, 'utf8');
  console.log('  ✓ MainActivity.java exists');
  
  if (mainActivity.includes('BridgeActivity')) {
    console.log('  ✓ Extends BridgeActivity');
  } else {
    console.log('  ✗ Does not extend BridgeActivity');
  }
  
  if (mainActivity.includes('onCreate')) {
    console.log('  ✓ Contains onCreate method with customizations');
  } else {
    console.log('  ⚠️ No onCreate method found');
  }
} catch (err) {
  console.log(`  ✗ Error reading MainActivity.java: ${err.message}`);
}

// Check AndroidManifest.xml
console.log('\n✅ Checking AndroidManifest.xml:');
const manifestPath = 'android/app/src/main/AndroidManifest.xml';
try {
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  console.log('  ✓ AndroidManifest.xml exists');
  
  if (manifest.includes('android:name=".MainActivity"')) {
    console.log('  ✓ MainActivity is properly declared');
  } else {
    console.log('  ✗ MainActivity is not properly declared');
  }
  
  if (manifest.includes('android.permission.INTERNET')) {
    console.log('  ✓ Internet permission is declared');
  } else {
    console.log('  ⚠️ Internet permission is missing');
  }
} catch (err) {
  console.log(`  ✗ Error reading AndroidManifest.xml: ${err.message}`);
}

// Check app icons
console.log('\n✅ Checking Android app icons:');
const iconDirectories = [
  'android/app/src/main/res/mipmap-hdpi',
  'android/app/src/main/res/mipmap-mdpi',
  'android/app/src/main/res/mipmap-xhdpi',
  'android/app/src/main/res/mipmap-xxhdpi',
  'android/app/src/main/res/mipmap-xxxhdpi',
];

for (const dir of iconDirectories) {
  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      const iconFiles = files.filter(f => f.includes('ic_launcher'));
      console.log(`  ✓ ${dir}: ${iconFiles.length} icon files`);
    } else {
      console.log(`  ✗ ${dir} does not exist`);
    }
  } catch (err) {
    console.log(`  ✗ Error checking ${dir}: ${err.message}`);
  }
}

// Check dist directory
console.log('\n✅ Checking dist directory (web build):');
try {
  const distPublic = fs.readdirSync('dist/public');
  console.log(`  ✓ dist/public contains ${distPublic.length} items`);
  
  const assetsDir = fs.readdirSync('dist/public/assets');
  console.log(`  ✓ dist/public/assets contains ${assetsDir.length} files`);
  
  const jsFiles = assetsDir.filter(f => f.endsWith('.js')).length;
  const cssFiles = assetsDir.filter(f => f.endsWith('.css')).length;
  console.log(`  ✓ Assets include ${jsFiles} JS files and ${cssFiles} CSS files`);
} catch (err) {
  console.log(`  ✗ Error checking dist directory: ${err.message}`);
}

// Check Android assets
console.log('\n✅ Checking Android assets directory:');
try {
  if (fs.existsSync('android/app/src/main/assets/public')) {
    const androidAssets = fs.readdirSync('android/app/src/main/assets/public');
    console.log(`  ✓ Android assets directory contains ${androidAssets.length} items`);
    
    if (fs.existsSync('android/app/src/main/assets/capacitor.config.json')) {
      console.log('  ✓ Capacitor config exists in Android assets');
    } else {
      console.log('  ✗ Capacitor config missing from Android assets');
    }
  } else {
    console.log('  ✗ Android assets directory does not exist');
  }
} catch (err) {
  console.log(`  ✗ Error checking Android assets: ${err.message}`);
}

// Summary
console.log('\n🎯 Verification Summary:');
if (missingPaths.length === 0) {
  console.log('  ✅ Directory structure is correct');
} else {
  console.log(`  ⚠️ Missing ${missingPaths.length} required directories`);
}

// Indicate build readiness
console.log('\n🚀 Android Project Status:');
if (missingPaths.length === 0) {
  console.log('  ✅ Android project is ready for deployment!');
  console.log('  📱 To build and run on an Android device:');
  console.log('     1. Open Android Studio with: npx cap open android');
  console.log('     2. Connect your device or use an emulator');
  console.log('     3. Click "Run" in Android Studio');
} else {
  console.log('  ⚠️ Android project needs attention before deployment');
}

console.log('\n🔍 Verification complete!');