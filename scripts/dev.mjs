import http from 'node:http';
import { pathToFileURL } from 'node:url';
import './build.mjs';

const port = Number(process.env.PORT || 4173);
const workerUrl = pathToFileURL(new URL('../dist/server/index.js', import.meta.url).pathname);
const { default: worker } = await import(workerUrl.href);

const server = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const result = await worker.fetch(new Request(`http://localhost:${port}${request.url || '/'}`, {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method || 'GET') ? undefined : Buffer.concat(chunks),
  }), process.env);
  response.writeHead(result.status, Object.fromEntries(result.headers));
  response.end(Buffer.from(await result.arrayBuffer()));
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Local: http://127.0.0.1:${port}/`);
});
