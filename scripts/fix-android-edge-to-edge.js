/**
 * fix-android-edge-to-edge.js
 *
 * Patches the Android native project after `cap sync` to enable edge-to-edge
 * display and remove deprecated StatusBar APIs that trigger Play Store warnings.
 *
 * What it does:
 * 1. MainActivity.java — Adds EdgeToEdge.enable(this) in onCreate()
 * 2. build.gradle — Adds androidx.activity dependency for EdgeToEdge class
 * 3. styles.xml — Sets transparent statusBarColor and navigationBarColor
 *
 * Run after `cap sync android`.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const ANDROID_APP = path.join(PROJECT_ROOT, 'android', 'app');
const MAIN_SRC = path.join(ANDROID_APP, 'src', 'main');

function fixMainActivity() {
  const filePath = path.join(MAIN_SRC, 'java', 'com', 'claw', 'control', 'MainActivity.java');

  if (!fs.existsSync(filePath)) {
    console.warn('!  MainActivity.java not found, skipping');
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  // Already patched
  if (content.includes('EdgeToEdge.enable')) {
    console.log('*  MainActivity.java already has EdgeToEdge.enable()');
    return true;
  }

  const patched = `package com.claw.control;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
`;

  fs.writeFileSync(filePath, patched);
  console.log('+  MainActivity.java patched with EdgeToEdge.enable()');
  return true;
}

function fixBuildGradle() {
  const filePath = path.join(ANDROID_APP, 'build.gradle');

  if (!fs.existsSync(filePath)) {
    console.warn('!  build.gradle not found, skipping');
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Already has the dependency
  if (content.includes('androidx.activity:activity')) {
    console.log('*  build.gradle already has androidx.activity dependency');
    return true;
  }

  // Insert before the appcompat line
  const anchor = 'implementation "androidx.appcompat:appcompat:$androidxAppCompatVersion"';
  if (!content.includes(anchor)) {
    console.warn('!  Could not find appcompat dependency line in build.gradle, skipping');
    return false;
  }

  content = content.replace(
    anchor,
    'implementation "androidx.activity:activity:$androidxActivityVersion"\n    ' + anchor
  );

  fs.writeFileSync(filePath, content);
  console.log('+  build.gradle patched with androidx.activity dependency');
  return true;
}

function fixStyles() {
  const filePath = path.join(MAIN_SRC, 'res', 'values', 'styles.xml');

  if (!fs.existsSync(filePath)) {
    console.warn('!  styles.xml not found, skipping');
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  // Already patched
  if (content.includes('android:statusBarColor') && content.includes('@android:color/transparent')) {
    console.log('*  styles.xml already has transparent system bar colors');
    return true;
  }

  // Add transparent bar colors to the NoActionBar style
  const anchor = '<item name="android:background">@null</item>';
  if (!content.includes(anchor)) {
    console.warn('!  Could not find NoActionBar background item in styles.xml, skipping');
    return false;
  }

  content = content.replace(
    anchor,
    anchor + '\n        <item name="android:navigationBarColor">@android:color/transparent</item>\n        <item name="android:statusBarColor">@android:color/transparent</item>'
  );

  fs.writeFileSync(filePath, content);
  console.log('+  styles.xml patched with transparent system bar colors');
  return true;
}

// Main
console.log('--- Android edge-to-edge post-sync patch ---');

if (!fs.existsSync(path.join(PROJECT_ROOT, 'android', 'app'))) {
  console.log('skip  Android project not found, skipping');
  process.exit(0);
}

const results = [fixMainActivity(), fixBuildGradle(), fixStyles()];

if (results.every(Boolean)) {
  console.log('done  Android edge-to-edge patches applied');
} else {
  console.warn('warn  Some patches could not be applied — check output above');
}
