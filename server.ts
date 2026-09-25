import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, '.data');
const STATE_FILE = path.join(DATA_DIR, 'store_state.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
}

const APK_PATHS = [
  path.join(__dirname, '.build-outputs', 'app-debug.apk'),
  path.join(__dirname, 'public', 'app-debug.apk')
];
const ZIP_PATHS = [
  path.join(__dirname, '.build-outputs', 'proyecto-completo.zip'),
  path.join(__dirname, 'public', 'proyecto-completo.zip')
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.apk': 'application/vnd.android.package-archive',
  '.zip': 'application/zip',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

// Default initial inventory items (raw ingredients & packaged drinks)
const INITIAL_INVENTORY = [
  { id: 'inv-pan-perro', name: 'Pan de Perros', category: 'Panes', stock: 60, unit: 'und', minAlert: 15 },
  { id: 'inv-pan-burger', name: 'Pan de Hamburguesa', category: 'Panes', stock: 50, unit: 'und', minAlert: 12 },
  { id: 'inv-salchicha', name: 'Salchichas', category: 'Embutidos', stock: 60, unit: 'und', minAlert: 15 },
  { id: 'inv-carne', name: 'Carne de Hamburguesa', category: 'Proteínas', stock: 50, unit: 'porciones', minAlert: 10 },
  { id: 'inv-pollo', name: 'Pollo Desmechado / Filete', category: 'Proteínas', stock: 40, unit: 'porciones', minAlert: 10 },
  { id: 'inv-chorizo', name: 'Chorizo', category: 'Embutidos', stock: 35, unit: 'porciones', minAlert: 10 },
  { id: 'inv-chuleta', name: 'Chuleta Ahumada', category: 'Proteínas', stock: 30, unit: 'porciones', minAlert: 10 },
  { id: 'inv-queso', name: 'Queso Amarillo / Mano', category: 'Lácteos', stock: 50, unit: 'porciones', minAlert: 12 },
  { id: 'inv-tocineta', name: 'Tocineta Crujiente', category: 'Embutidos', stock: 40, unit: 'porciones', minAlert: 10 },
  { id: 'inv-salsas', name: 'Raciones de Salsas', category: 'Salsas', stock: 120, unit: 'raciones', minAlert: 25 },
  { id: 'inv-papas', name: 'Papas Fritas', category: 'Guarniciones', stock: 35, unit: 'porciones', minAlert: 8 },
  { id: 'inv-refresco', name: 'Refresco 355ml', category: 'Bebidas', stock: 48, unit: 'latas/botellas', minAlert: 12 },
  { id: 'inv-malta', name: 'Malta Polar', category: 'Bebidas', stock: 36, unit: 'botellas', minAlert: 10 },
  { id: 'inv-agua', name: 'Agua Mineral 500ml', category: 'Bebidas', stock: 40, unit: 'botellas', minAlert: 10 }
];

// Persistent Store State
let syncedState = {
  inventory: [...INITIAL_INVENTORY],
  damages: [], // { id, ingredientId, ingredientName, quantity, unit, reason, date, time }
  pairingPin: '8492',
  version: 1,
  lastUpdated: new Date().toISOString()
};

// Load saved state if exists
if (fs.existsSync(STATE_FILE)) {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.inventory)) {
      syncedState = parsed;
    }
  } catch (err) {
    console.error('[State] Error reading persistent state file:', err.message);
  }
}

function saveSyncedState() {
  try {
    syncedState.lastUpdated = new Date().toISOString();
    syncedState.version = (syncedState.version || 1) + 1;
    fs.writeFileSync(STATE_FILE, JSON.stringify(syncedState, null, 2), 'utf8');
  } catch (err) {
    console.error('[State] Error saving persistent state:', err.message);
  }
}

// Connected SSE clients
const sseClients = new Set();

function broadcastEvent(eventType, payload) {
  const data = JSON.stringify({
    type: eventType,
    payload,
    state: syncedState,
    timestamp: new Date().toISOString()
  });

  for (const client of sseClients) {
    try {
      client.write(`event: sync\ndata: ${data}\n\n`);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses.length > 0 ? addresses : ['127.0.0.1'];
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// Request Handler
async function requestHandler(req, res) {
  try {
    // Global CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Terminal-Role, X-Pairing-Pin');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    let pathname = '/';
    try {
      const hostHeader = req.headers.host || 'localhost';
      const parsedUrl = new URL(req.url || '/', `http://${hostHeader}`);
      pathname = parsedUrl.pathname;
    } catch (_) {
      pathname = (req.url || '/').split('?')[0];
    }

    // 1. Health & Readiness Checks (for Cloud Run, Kubernetes, App Engine probes)
    if (
      pathname === '/api/health' ||
      pathname === '/healthz' ||
      pathname === '/health' ||
      pathname === '/_health' ||
      pathname === '/_ah/health' ||
      pathname === '/_ah/warmup' ||
      pathname === '/ready' ||
      pathname === '/live' ||
      pathname === '/ping' ||
      pathname === '/status'
    ) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      if (req.method === 'HEAD') return res.end();
      return res.end(JSON.stringify({ status: 'ok', service: 'control-de-ventas', timestamp: new Date().toISOString() }));
    }

    // 2. Real-Time Sync Network Info
    if (pathname === '/api/sync/network') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      const devUrl = process.env.APP_URL || '';
      let sharedUrl = process.env.SHARED_APP_URL || '';
      if (!sharedUrl && devUrl) {
        sharedUrl = devUrl.replace('ais-dev-', 'ais-pre-');
      }
      return res.end(JSON.stringify({
        localIps: getLocalIpAddresses(),
        port: primaryPort,
        pairingPin: syncedState.pairingPin || '8492',
        connectedClients: sseClients.size,
        inventoryCount: (syncedState.inventory || []).length,
        lastUpdated: syncedState.lastUpdated,
        devAppUrl: devUrl,
        sharedAppUrl: sharedUrl,
        apkDownloadUrl: '/download/app-debug.apk',
        zipDownloadUrl: '/download/proyecto-completo.zip'
      }));
    }

    // 3. Real-Time Sync State Endpoint (GET)
    if (pathname === '/api/sync/state' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
      return res.end(JSON.stringify(syncedState));
    }

    // 4. Real-Time Sync SSE Stream (GET)
    if (pathname === '/api/sync/stream' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      sseClients.add(res);

      // Send initial snapshot
      res.write(`event: init\ndata: ${JSON.stringify(syncedState)}\n\n`);

      // Keepalive ping every 15 seconds
      const interval = setInterval(() => {
        try {
          res.write(': keepalive\n\n');
        } catch (_) {
          clearInterval(interval);
          sseClients.delete(res);
        }
      }, 15000);

      req.on('close', () => {
        clearInterval(interval);
        sseClients.delete(res);
      });
      return;
    }

    // 5. Real-Time Sync Actions (POST)
    if (pathname === '/api/sync/action' && req.method === 'POST') {
      try {
        const payload = await parseJsonBody(req);
        const actionType = payload.action;
        const data = payload.data || {};

        if (actionType === 'SALE_REGISTERED') {
          // Automatic deduction of inventory based on sale ingredients
          const deductions = data.deductions || [];
          for (const item of deductions) {
            const invItem = syncedState.inventory.find(i => i.id === item.id || i.name.toLowerCase() === item.name.toLowerCase());
            if (invItem) {
              invItem.stock = Math.max(0, parseFloat((invItem.stock - item.quantity).toFixed(2)));
            }
          }
          saveSyncedState();
          broadcastEvent('SALE_REGISTERED', { sale: data.sale, deductions });
        } else if (actionType === 'STOCK_ADJUSTED') {
          // Manual stock adjustment
          const invItem = syncedState.inventory.find(i => i.id === data.id);
          if (invItem) {
            invItem.stock = Math.max(0, parseFloat(Number(data.stock).toFixed(2)));
            if (data.name) invItem.name = data.name;
            if (data.minAlert !== undefined) invItem.minAlert = Number(data.minAlert);
            saveSyncedState();
            broadcastEvent('STOCK_ADJUSTED', { item: invItem });
          }
        } else if (actionType === 'STOCK_ADDED') {
          // Add new inventory item
          const newItem = {
            id: data.id || `inv-${Date.now()}`,
            name: data.name || 'Nuevo Insumo',
            category: data.category || 'Varios',
            stock: Math.max(0, parseFloat(Number(data.stock || 0).toFixed(2))),
            unit: data.unit || 'und',
            minAlert: Math.max(0, Number(data.minAlert || 5))
          };
          syncedState.inventory.push(newItem);
          saveSyncedState();
          broadcastEvent('STOCK_ADDED', { item: newItem });
        } else if (actionType === 'DAMAGE_REPORTED') {
          // Report damaged items & deduct from inventory
          const invItem = syncedState.inventory.find(i => i.id === data.ingredientId);
          const qty = Math.max(0, parseFloat(Number(data.quantity || 0).toFixed(2)));
          if (invItem && qty > 0) {
            invItem.stock = Math.max(0, parseFloat((invItem.stock - qty).toFixed(2)));
          }
          const damageEntry = {
            id: `dmg-${Date.now()}`,
            ingredientId: data.ingredientId,
            ingredientName: invItem ? invItem.name : (data.ingredientName || 'Insumo'),
            quantity: qty,
            unit: invItem ? invItem.unit : (data.unit || 'und'),
            reason: data.reason || 'Dañado / Vencido',
            date: new Date().toISOString().split('T')[0],
            time: new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            reportedBy: data.reportedBy || 'Terminal'
          };
          if (!syncedState.damages) syncedState.damages = [];
          syncedState.damages.unshift(damageEntry);
          saveSyncedState();
          broadcastEvent('DAMAGE_REPORTED', { damage: damageEntry, updatedItem: invItem });
        } else if (actionType === 'SYNC_FULL_STATE') {
          // Full state sync from authorized master
          if (Array.isArray(data.inventory)) syncedState.inventory = data.inventory;
          if (Array.isArray(data.damages)) syncedState.damages = data.damages;
          if (data.pairingPin) syncedState.pairingPin = data.pairingPin;
          saveSyncedState();
          broadcastEvent('STATE_REPLACED', syncedState);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, state: syncedState }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    }

    // 6. Direct APK download route
    if (
      pathname === '/download/app-debug.apk' ||
      pathname === '/app-debug.apk' ||
      pathname === '/ControlVentasTienda-debug.apk' ||
      pathname.endsWith('/app-debug.apk') ||
      pathname.endsWith('app-debug.apk')
    ) {
      const validApk = APK_PATHS.find(p => fs.existsSync(p));
      if (validApk) {
        const stat = fs.statSync(validApk);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Length': stat.size,
          'Content-Disposition': 'attachment; filename="ControlVentasTienda-debug.apk"'
        });
        if (req.method === 'HEAD') return res.end();
        const apkStream = fs.createReadStream(validApk);
        apkStream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
        return apkStream.pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('APK no disponible. Compile la aplicación primero.');
      }
    }

    // 7. Direct ZIP download route
    if (
      pathname === '/download/proyecto-completo.zip' ||
      pathname === '/download/project.zip' ||
      pathname === '/proyecto-completo.zip' ||
      pathname === '/proyecto.zip' ||
      pathname.endsWith('proyecto-completo.zip')
    ) {
      const validZip = ZIP_PATHS.find(p => fs.existsSync(p));
      if (validZip) {
        const stat = fs.statSync(validZip);
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Length': stat.size,
          'Content-Disposition': 'attachment; filename="ControlVentas-ProyectoCompleto.zip"'
        });
        if (req.method === 'HEAD') return res.end();
        const zipStream = fs.createReadStream(validZip);
        zipStream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
        return zipStream.pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Archivo ZIP no disponible en este momento.');
      }
    }

    // 8. Serve static files from public directory
    let relativeFilePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    let filePath = path.join(PUBLIC_DIR, relativeFilePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache'
      });
      if (req.method === 'HEAD') return res.end();
      const fileStream = fs.createReadStream(filePath);
      fileStream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
      return fileStream.pipe(res);
    }

    // Fallback to index.html for Single Page Application
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      const stat = fs.statSync(indexPath);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': stat.size,
        'Cache-Control': 'no-cache'
      });
      if (req.method === 'HEAD') return res.end();
      const indexStream = fs.createReadStream(indexPath);
      indexStream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
      return indexStream.pipe(res);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (globalErr) {
    console.error('[Server Request Error]', globalErr);
    try {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ error: 'Internal Server Error', message: globalErr.message }));
    } catch (_) {}
  }
}

// Ports configuration:
// In Cloud Run, PORT is set (typically 8080) and HOST is 0.0.0.0.
// In AI Studio dev/preview environment, Nginx proxies requests to port 3000.
// We bind to 0.0.0.0 to satisfy the Cloud Run container runtime contract.
const targetPorts = new Set();
const primaryPort = parseInt(process.env.PORT || '8080', 10);
targetPorts.add(primaryPort);

// In local development or dev-container preview, also listen on port 3000 for Nginx proxying
if (process.env.NODE_ENV !== 'production' || process.env.DEFAULT_APP_PORT) {
  targetPorts.add(3000);
}
if (process.env.DEFAULT_APP_PORT) {
  targetPorts.add(parseInt(process.env.DEFAULT_APP_PORT, 10));
}

const activeServers = [];
const host = process.env.HOST || '0.0.0.0';

for (const port of targetPorts) {
  const srv = http.createServer(requestHandler);
  srv.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Server] Port ${port} on ${host} is occupied (e.g. reverse proxy active). Continuing with other listeners.`);
    } else {
      console.error(`[Server] Error on port ${port} (${host}):`, err.message);
    }
  });

  // Explicitly binding to 0.0.0.0 ensures Cloud Run's IPv4 health probes succeed
  srv.listen(port, host, () => {
    console.log(`[Server] Control de Ventas al Detal running on ${host}:${port}`);
    activeServers.push(srv);
  });
}

function gracefulShutdown() {
  console.log('[Server] Gracefully stopping servers...');
  for (const s of activeServers) {
    try { s.close(); } catch (_) {}
  }
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('uncaughtException', (err) => {
  console.error('[Server UncaughtException]', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server UnhandledRejection]', reason);
});

