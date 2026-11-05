import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { FastifyInstance } from 'fastify';

// Portal web (React + Tailwind). O código fica em "frontend/" e o build (npm run build:web) gera a pasta "web/".
// Aqui só servimos o que está nessa pasta: a lista de arquivos é montada ao subir e a URL só escolhe uma
// entrada dessa lista, então nenhum caminho vindo da requisição chega ao sistema de arquivos.
// WEB_DIR permite apontar para outra pasta (usado nos testes).
const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

const PAGINA_FALTANDO = `<!doctype html><meta charset="utf-8"><title>Greencode</title>
<p style="font-family:sans-serif;max-width:40rem;margin:3rem auto">O portal ainda não foi compilado. Rode <code>npm run build:web</code> e reinicie o servidor.</p>`;

function listar(pasta: string, prefixo = ''): string[] {
  const nomes: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) nomes.push(...listar(caminho, `${prefixo}${nome}/`));
    else nomes.push(`${prefixo}${nome}`);
  }
  return nomes;
}

export async function rotasWeb(app: FastifyInstance): Promise<void> {
  const pasta = process.env.WEB_DIR || join(__dirname, '..', '..', 'web');
  const arquivos = new Map<string, { tipo: string; conteudo: Buffer }>();
  if (existsSync(join(pasta, 'index.html'))) {
    for (const nome of listar(pasta)) {
      const tipo = TIPOS[extname(nome).toLowerCase()];
      if (tipo) arquivos.set(nome, { tipo, conteudo: readFileSync(join(pasta, nome)) });
    }
  } else {
    app.log.warn('Portal não compilado: rode "npm run build:web".');
  }

  app.get<{ Params: { '*': string } }>('/app/*', { schema: { hide: true } }, async (req, reply) => {
    const nome = req.params['*'] || 'index.html';
    const item = arquivos.get(nome);
    if (!arquivos.size) return reply.status(503).type('text/html; charset=utf-8').send(PAGINA_FALTANDO);
    if (!item) return reply.status(404).send({ erro: 'NAO_ENCONTRADO', mensagem: 'Arquivo não encontrado.' });
    // index.html sempre revalidado; arquivos com hash no nome podem ficar em cache.
    const cache = nome === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable';
    return reply.header('Cache-Control', cache).type(item.tipo).send(item.conteudo);
  });
  app.get('/app', { schema: { hide: true } }, async (_req, reply) => reply.redirect('/app/'));
}

// Oliver passou por aqui.
