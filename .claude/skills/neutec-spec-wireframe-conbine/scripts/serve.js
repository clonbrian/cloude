#!/usr/bin/env node
'use strict';

// Static file server for the rendered-verification layer. Plain Node, no deps.
//
//   node scripts/serve.js <export-folder> [--port 8731] [--timeout 300]
//
// This exists because the rendered layer needs an http:// origin — the browser refuses a
// file: URL outright — and the alternative was the instruction "serve it with a node
// one-liner", which meant hand-writing a server every run. In a skill whose central claim is
// that nothing in the pipeline is hand-written, that was the wrong shape: hand-written code
// in the verification path is exactly what verification is supposed to rule out.
//
// It shuts itself down after --timeout seconds (default 300). That is deliberate: a server
// that has to be killed needs process-killing tools in allowed-tools, and a forgotten one
// holds a port across sessions. Self-termination makes "confirm the port is released"
// something the script guarantees rather than something the caller has to remember.

const fs = require('fs');
const http = require('http');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function die(msg) {
  process.stderr.write(`serve: ${msg}\n`);
  process.exit(2);
}

function main() {
  const argv = process.argv.slice(2);
  const positional = [];
  let port = 8731;
  let timeout = 300;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') port = Number(argv[++i]);
    else if (argv[i] === '--timeout') timeout = Number(argv[++i]);
    else positional.push(argv[i]);
  }
  if (!positional.length) die('usage: node scripts/serve.js <export-folder> [--port N] [--timeout SECONDS]');
  const root = path.resolve(positional[0]);
  if (!fs.existsSync(root)) die(`folder not found: ${root}`);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) die(`--port must be 1024-65535, got ${port}`);
  if (!Number.isFinite(timeout) || timeout <= 0) die(`--timeout must be a positive number of seconds`);

  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(String(req.url).split('?')[0]).replace(/^\/+/, '');
    const file = path.resolve(root, rel);
    // Never serve outside the folder that was asked for.
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403);
      return res.end('forbidden');
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('not found');
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });

  server.on('error', (e) => {
    die(
      e.code === 'EADDRINUSE'
        ? `port ${port} is already in use — another session may be verifying an export (see SKILL.md Concurrent Session Guard), or pass --port`
        : e.message
    );
  });

  server.listen(port, '127.0.0.1', () => {
    const names = fs
      .readdirSync(root)
      .filter((f) => f.endsWith('.html'))
      .sort();
    process.stdout.write(`serving ${root} at http://localhost:${port}/ for ${timeout}s\n`);
    for (const n of names) process.stdout.write(`  http://localhost:${port}/${n}\n`);
    process.stdout.write('shuts itself down when the timeout elapses; no kill needed\n');
  });

  // Unref'd so the timer itself never holds the process open past its own firing.
  setTimeout(() => {
    server.close(() => {
      process.stdout.write(`timeout reached; port ${port} released\n`);
      process.exit(0);
    });
    // A browser keeping a connection alive would otherwise delay close() indefinitely.
    server.closeAllConnections?.();
  }, timeout * 1000).unref?.();
}

main();
