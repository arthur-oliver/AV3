// Regressão: com o limite geral por IP ligado (como fora dos testes), as respostas da API pública devem
// mostrar o limite da CHAVE nos cabeçalhos X-RateLimit-*, e não o limite geral (que os sobrescrevia).
import { describe, expect, it } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { registrarChaveApi } from '../../src/plugins/chaveApi';
import { registrarTratamentoErros } from '../../src/plugins/erros';
import { gerarChave } from '../../src/seguranca/chaveApi';
import type { ChaveApiRepositorio } from '../../src/repositorios/ChaveApiRepositorio';

async function montar(limiteDaChave: number, limiteGeral: number) {
  const { chave, prefixo, hash } = gerarChave();
  const registro = { id: 'chave-1', nome: 'Teste', organizacaoId: 'org-1', prefixo, hashChave: hash, permissoes: [], limitePorMinuto: limiteDaChave, ativa: true, expiraEm: null, ultimoUsoEm: new Date() };
  const repo = { buscarPorPrefixo: async (p: string) => (p === prefixo ? registro : null), registrarUso: async () => undefined } as unknown as ChaveApiRepositorio;

  const app = Fastify();
  await app.register(rateLimit, { max: limiteGeral, timeWindow: '1 minute' });
  registrarTratamentoErros(app);
  await registrarChaveApi(app, repo);
  app.get('/eu', { onRequest: app.exigirChave() }, async () => ({ ok: true }));
  await app.ready();
  const chamar = () => app.inject({ method: 'GET', url: '/eu', headers: { 'x-api-key': chave } });
  return { app, chamar };
}

describe('cabeçalhos de limite da API pública com o limite geral por IP ligado', () => {
  it('mostram o limite da chave, não o limite geral', async () => {
    const { app, chamar } = await montar(60, 300);
    const r = await chamar();
    expect(r.statusCode).toBe(200);
    expect(r.headers['x-ratelimit-limit']).toBe('60');
    expect(r.headers['x-ratelimit-remaining']).toBe('59');
    await app.close();
  });

  it('ao estourar o limite da chave: 429 com os números da chave', async () => {
    const { app, chamar } = await montar(2, 300);
    await chamar();
    await chamar();
    const r = await chamar();
    expect(r.statusCode).toBe(429);
    expect(r.json().erro).toBe('LIMITE_DA_CHAVE');
    expect(r.headers['x-ratelimit-limit']).toBe('2');
    expect(r.headers['x-ratelimit-remaining']).toBe('0');
    await app.close();
  });

  it('se quem bloqueia é o limite geral, o 429 continua com os números do limite geral', async () => {
    const { app, chamar } = await montar(60, 1);
    await chamar();
    const r = await chamar();
    expect(r.statusCode).toBe(429);
    expect(r.headers['x-ratelimit-limit']).toBe('1');
    await app.close();
  });
});
