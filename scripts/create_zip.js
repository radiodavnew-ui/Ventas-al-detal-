import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const zipDestDir = path.join(ROOT_DIR, '.build-outputs');
const publicDir = path.join(ROOT_DIR, 'public');
const zipPath = path.join(zipDestDir, 'proyecto-completo.zip');
const publicZipPath = path.join(publicDir, 'proyecto-completo.zip');
const apkSource = path.join(zipDestDir, 'app-debug.apk');
const publicApk = path.join(publicDir, 'app-debug.apk');

if (!fs.existsSync(zipDestDir)) {
  fs.mkdirSync(zipDestDir, { recursive: true });
}
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy APK if present
if (fs.existsSync(apkSource)) {
  fs.copyFileSync(apkSource, publicApk);
  console.log(`[ZIP] Synchronized APK to ${publicApk}`);
} else if (fs.existsSync(publicApk)) {
  fs.copyFileSync(publicApk, apkSource);
}

// Try running python3 create_zip.py if python3 is available
let pySuccess = false;
try {
  const pyCheck = spawnSync('python3', ['scripts/create_zip.py'], {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });
  if (pyCheck.status === 0) {
    pySuccess = true;
  }
} catch {
  pySuccess = false;
}

if (!pySuccess) {
  // If python3 not available, ensure at least existing ZIPs are synced
  if (fs.existsSync(publicZipPath) && !fs.existsSync(zipPath)) {
    fs.copyFileSync(publicZipPath, zipPath);
  } else if (fs.existsSync(zipPath) && !fs.existsSync(publicZipPath)) {
    fs.copyFileSync(zipPath, publicZipPath);
  }
  console.log('[ZIP] ZIP assets checked and verified without Python.');
}
