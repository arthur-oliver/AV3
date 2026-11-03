import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

// Portal web (interface para parceiros e equipe interna). São quatro arquivos estáticos, lidos uma vez ao subir.
// Só os nomes da lista abaixo são servidos: nenhum caminho vindo da URL chega ao sistema de arquivos.
// A pasta "web" fica ao lado de "src" (e de "dist"), então o caminho é o mesmo rodando com tsx ou compilado.
const PASTA = join(__dirname, '..', '..', 'web');
const ARQUIVOS: Record<string, { arquivo: string; tipo: string }> = {
  '': { arquivo: 'index.html', tipo: 'text/html; charset=utf-8' },
  'app.css': { arquivo: 'app.css', tipo: 'text/css; charset=utf-8' },
  'app.js': { arquivo: 'app.js', tipo: 'text/javascript; charset=utf-8' },
  'interno.js': { arquivo: 'interno.js', tipo: 'text/javascript; charset=utf-8' }
};

export async function rotasWeb(app: FastifyInstance): Promise<void> {
  const conteudo = new Map<string, string>();
  for (const [nome, { arquivo }] of Object.entries(ARQUIVOS)) conteudo.set(nome, readFileSync(join(PASTA, arquivo), 'utf8'));

  app.get<{ Params: { '*': string } }>('/app/*', { schema: { hide: true } }, async (req, reply) => {
    const nome = req.params['*'];
    const item = Object.hasOwn(ARQUIVOS, nome) ? ARQUIVOS[nome] : undefined;
    if (!item) return reply.status(404).send({ erro: 'NAO_ENCONTRADO', mensagem: 'Arquivo não encontrado.' });
    return reply.header('Cache-Control', 'no-cache').type(item.tipo).send(conteudo.get(nome));
  });
  app.get('/app', { schema: { hide: true } }, async (_req, reply) => reply.redirect('/app/'));
}


// Oliver passou por aqui.
