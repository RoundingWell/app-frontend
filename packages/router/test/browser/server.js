import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Serves the package root and @mnjs/utils to the conformance page. Any other
// path returns 404, so a navigation the router fails to intercept shows up as a
// document load instead of silently restarting the page.
const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const utilsRoot = dirname(fileURLToPath(import.meta.resolve('@mnjs/utils')));
const port = Number(process.env.ROUTER_CONFORMANCE_PORT || 8097);

const types = { '.html': 'text/html', '.js': 'text/javascript' };

function fileFor(pathname) {
  if (pathname === '/') return join(packageRoot, 'test/browser/index.html');
  const [root, prefix] = pathname.startsWith('/@mnjs/utils/') ?
    [utilsRoot, '/@mnjs/utils/'] :
    [packageRoot, '/'];
  const file = normalize(join(root, decodeURIComponent(pathname.slice(prefix.length))));
  if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) return null;
  return types[extname(file)] ? file : null;
}

createServer(async(request, response) => {
  const file = fileFor(new URL(request.url, 'http://localhost').pathname);
  try {
    if (!file) throw new Error('not served');
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)], 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain' });
    response.end(`Not found: ${ request.url }`);
  }
}).listen(port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`router conformance page on http://127.0.0.1:${ port }/`);
});
