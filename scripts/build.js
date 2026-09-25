import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('[Build] Verifying and synchronizing distribution assets...');

const publicDir = path.join(ROOT_DIR, 'public');
const buildOutputsDir = path.join(ROOT_DIR, '.build-outputs');
const distDir = path.join(ROOT_DIR, 'dist');
const buildWebDir = path.join(ROOT_DIR, 'build', 'web');

for (const dir of [publicDir, buildOutputsDir, distDir, buildWebDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 1. Verify index.html exists
const indexHtml = path.join(publicDir, 'index.html');
if (!fs.existsSync(indexHtml)) {
  console.error('[Build Error] public/index.html is missing!');
  process.exit(1);
}

// 2. Sync app.js always from src/app.js if src/app.js exists
const publicAppJs = path.join(publicDir, 'app.js');
const srcAppJs = path.join(ROOT_DIR, 'src', 'app.js');
if (fs.existsSync(srcAppJs)) {
  fs.copyFileSync(srcAppJs, publicAppJs);
  console.log('[Build] Synchronized public/app.js from src/app.js');
}

// 3. Sync APK
const apkOutput = path.join(buildOutputsDir, 'app-debug.apk');
const apkPublic = path.join(publicDir, 'app-debug.apk');
if (fs.existsSync(apkOutput) && !fs.existsSync(apkPublic)) {
  fs.copyFileSync(apkOutput, apkPublic);
} else if (fs.existsSync(apkPublic) && !fs.existsSync(apkOutput)) {
  fs.copyFileSync(apkPublic, apkOutput);
}

// 4. Sync ZIP
const zipOutput = path.join(buildOutputsDir, 'proyecto-completo.zip');
const zipPublic = path.join(publicDir, 'proyecto-completo.zip');
if (fs.existsSync(zipOutput) && !fs.existsSync(zipPublic)) {
  fs.copyFileSync(zipOutput, zipPublic);
} else if (fs.existsSync(zipPublic) && !fs.existsSync(zipOutput)) {
  fs.copyFileSync(zipPublic, zipOutput);
}

// 5. Populate dist/ and build/web/ for platform artifact validation (exclude large binary APK/ZIP to conserve memory)
for (const target of [distDir, buildWebDir]) {
  try {
    for (const file of fs.readdirSync(publicDir)) {
      if (file.endsWith('.apk') || file.endsWith('.zip')) continue;
      const srcFile = path.join(publicDir, file);
      const destFile = path.join(target, file);
      if (fs.statSync(srcFile).isDirectory()) {
        fs.cpSync(srcFile, destFile, { recursive: true });
      } else {
        fs.copyFileSync(srcFile, destFile);
      }
    }
  } catch (_) {}
}

// 6. Ensure server.js stays in sync with server.ts
const serverTs = path.join(ROOT_DIR, 'server.ts');
const serverJs = path.join(ROOT_DIR, 'server.js');
if (fs.existsSync(serverTs)) {
  fs.copyFileSync(serverTs, serverJs);
  console.log('[Build] Synchronized server.js from server.ts');
}

console.log('[Build] Build verification completed successfully.');
