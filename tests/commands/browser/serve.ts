/**
 * Test server for browser command testing
 * 
 * Usage:
 * 1. Run with: pnpm serve-test
 * 2. Server starts at http://localhost:3000
 * 3. Place test HTML files in tests/commands/browser/
 * 4. Access files at http://localhost:3000/filename.html
 * 
 * Default test page: http://localhost:3000 (serves console-log.html)
 */

import { join } from 'node:path';

const port = process.env?.PORT ?? 3000;
console.log(`Starting server on http://localhost:${port}`);

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = url.pathname === '/' ? 'console-log.html' : url.pathname.slice(1);
    const fullPath = join(import.meta.dir, filePath);
    const file = Bun.file(fullPath);
    
    try {
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response('404 Not Found', { status: 404 });
    } catch (error) {
      console.error(`Error serving ${filePath}:`, error);
      return new Response('500 Internal Server Error', { status: 500 });
    }
  }
});