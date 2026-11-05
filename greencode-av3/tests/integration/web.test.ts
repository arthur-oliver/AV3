// Teste do portal web: a raiz leva ao portal e só os arquivos compilados são servidos.
// Usa uma pasta temporária (WEB_DIR) no lugar do build real, para não depender de "npm run build:web".
// Não consulta o banco, mas o app precisa do .env (DATABASE_URL e JWT_SECRET) para subir.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../src/app';

let app: FastifyInstance;
let pasta: string;
beforeAll(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'gc-web-'));
  mkdirSync(join(pasta, 'assets'));
  writeFileSync(join(pasta, 'index.html'), '<!doctype html><div id="raiz"></div><script type="module" src="/app/assets/app.js"></script>');
  writeFileSync(join(pasta, 'assets', 'app.js'), 'console.log("ok");');
  writeFileSync(join(pasta, 'assets', 'app.css'), 'body{margin:0}');
  writeFileSync(join(pasta, 'segredo.txt'), 'nao servir');
  process.env.WEB_DIR = pasta;
  app = await construirApp();
});
afterAll(async () => {
  await app.close();
  delete process.env.WEB_DIR;
  rmSync(pasta, { recursive: true, force: true });
});

describe('portal web', () => {
  it('a raiz redireciona para /app/', async () => {
    const r = await app.inject({ method: 'GET', url: '/' });
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toBe('/app/');
  });

  it('serve a página, o script e o estilo com o tipo certo', async () => {
    const pagina = await app.inject({ method: 'GET', url: '/app/' });
    expect(pagina.statusCode).toBe(200);
    expect(pagina.headers['content-type']).toContain('text/html');
    expect(pagina.body).toContain('id="raiz"');
    const js = await app.inject({ method: 'GET', url: '/app/assets/app.js' });
    expect(js.headers['content-type']).toContain('javascript');
    const css = await app.inject({ method: 'GET', url: '/app/assets/app.css' });
    expect(css.headers['content-type']).toContain('text/css');
  });

  it('não serve arquivo fora da lista de tipos, nem com caminho disfarçado', async () => {
    for (const url of ['/app/segredo.txt', '/app/package.json', '/app/../package.json', '/app/%2e%2e/.env', '/app/constructor', '/app/__proto__']) {
      const r = await app.inject({ method: 'GET', url });
      expect(r.statusCode).toBe(404);
    }
  });

  it('não aparece no Swagger', async () => {
    const r = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(Object.keys(r.json().paths).some((p) => p.startsWith('/app'))).toBe(false);
  });
});

// Alves aprova este código.
