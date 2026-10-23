// Serves the ERP and CRM demos under one origin locally, laid out as on GitHub Pages
// (https://lenatardis.github.io/ego_ERP_local/ and /ego_CRM_local/). The two apps share data through
// localStorage (workspace CLAUDE.md, "Cross-app contract"), which only works on one origin — their own dev
// servers are different origins. Same script in both repos; expects the sibling layout of the workspace:
//   ego_local/ego_ERP_local  and  ego_local/ego_CRM_local
//
// Dev mode (default): forwards to the two running dev servers, hot reload included.
//   ERP:  BASE_PATH=/ego_ERP_local/ pnpm dev        (Vite, http://localhost:5173)
//   CRM:  npm start                                  (CRA,  http://localhost:3000)
//   then: node scripts/same-origin.mjs               -> http://localhost:8080/
// Static mode: serves the production builds, falling back to the app's index.html like Pages' 404.html.
//   ERP:  BASE_PATH=/ego_ERP_local/ pnpm build      (-> dist/)
//   CRM:  npm run build                              (-> build/)
//   then: node scripts/same-origin.mjs --static
// Options (env): PORT (8080), ERP_DEV_URL (http://localhost:5173), CRM_DEV_URL (http://localhost:3000).
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 8080;
const STATIC = process.argv.includes('--static');
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const APPS = [
    { name: 'ERP', base: '/ego_ERP_local/', dev: process.env.ERP_DEV_URL || 'http://localhost:5173', dir: path.join(workspace, 'ego_ERP_local', 'dist') },
    { name: 'CRM', base: '/ego_CRM_local/', dev: process.env.CRM_DEV_URL || 'http://localhost:3000', dir: path.join(workspace, 'ego_CRM_local', 'build') },
];
const CRM = APPS[1];

/** The app a request path belongs to. CRA's dev client opens its hot-reload socket at /ws, outside the base path. */
const appFor = (urlPath) => APPS.find((app) => urlPath.startsWith(app.base) || `${urlPath}/` === app.base)
    ?? (!STATIC && urlPath.startsWith('/ws') ? CRM : null);

const indexPage = () => `<!doctype html><meta charset="utf-8"><title>Ego demos</title>
<body style="font-family:sans-serif;margin:40px">
<h1>Ego demos on one origin (${STATIC ? 'production builds' : 'dev servers'})</h1>
<ul>${APPS.map((a) => `<li><a href="${a.base}">${a.name}</a> — ${STATIC ? a.dir : a.dev}</li>`).join('')}</ul>
</body>`;

const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.map': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
    '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
};

const serveStatic = (app, urlPath, res) => {
    const rel = decodeURIComponent(urlPath.slice(app.base.length));
    let file = path.join(app.dir, rel);
    if (file !== app.dir && !file.startsWith(app.dir + path.sep)) {
        res.writeHead(403).end();
        return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        const index = path.join(file, 'index.html');
        // a deep link (no such file): the app's index.html, as GitHub Pages serves 404.html
        file = fs.existsSync(index) ? index : path.join(app.dir, 'index.html');
    }
    if (!fs.existsSync(file)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`${app.name} build not found in ${app.dir}`);
        return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
};

const proxy = (app, req, res) => {
    const target = new URL(app.dev);
    const upstream = http.request({
        hostname: target.hostname, port: target.port, method: req.method, path: req.url, headers: req.headers,
    }, (up) => {
        res.writeHead(up.statusCode, up.headers);
        up.pipe(res);
    });
    upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`${app.name} dev server is not running at ${app.dev}`);
    });
    req.pipe(upstream);
};

const server = http.createServer((req, res) => {
    const urlPath = new URL(req.url, 'http://localhost').pathname;
    if (urlPath === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(indexPage());
        return;
    }
    const app = appFor(urlPath);
    if (!app) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    } else if (STATIC) {
        serveStatic(app, urlPath, res);
    } else {
        proxy(app, req, res);
    }
});

// hot-reload websockets (dev mode): pass the upgrade request through to the dev server as raw TCP
server.on('upgrade', (req, socket, head) => {
    const app = STATIC ? null : appFor(new URL(req.url, 'http://localhost').pathname);
    if (!app) {
        socket.destroy();
        return;
    }
    const target = new URL(app.dev);
    const upstream = net.connect(Number(target.port), target.hostname, () => {
        const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
        upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`);
        if (head?.length) upstream.write(head);
        upstream.pipe(socket);
        socket.pipe(upstream);
    });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
});

server.listen(PORT, () => {
    console.log(`Ego demos on one origin (${STATIC ? 'production builds' : 'dev servers'}): http://localhost:${PORT}/`);
    APPS.forEach((a) => console.log(`  ${a.name}: http://localhost:${PORT}${a.base}  <-  ${STATIC ? a.dir : a.dev}`));
});
