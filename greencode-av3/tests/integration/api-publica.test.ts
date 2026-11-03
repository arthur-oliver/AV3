// Teste de integração da API pública (v1): chaves, permissões, isolamento entre organizações, limite por chave
// e versionamento. Pré-requisitos: banco migrado e populado (npm run setup) e .env configurado.
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { criarCliente } from '../helpers/api';

const ORG_BANCO = '00000000-0000-4000-8000-0000000000a1';
const ORG_HOSPITAL = '00000000-0000-4000-8000-0000000000a2';
const LOTE_HOSPITAL = '00000000-0000-4000-8000-0000000000b2';
const EQUIP_BANCO = '00000000-0000-4000-8000-0000000000c3'; // lote do banco
const EQUIP_HOSPITAL = '00000000-0000-4000-8000-0000000000c5'; // lote do hospital
const PREFIXO_NOME = 'teste-';

let app: FastifyInstance;
let api: ReturnType<typeof criarCliente>;
const tokens: Record<string, string> = {};

const pub = (chave: string | undefined, metodo: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method: metodo, url: `/api/v1/public${url}`, payload, headers: chave ? { 'x-api-key': chave } : {} });

async function criarChave(permissoes: string[], extra: Record<string, unknown> = {}, organizacaoId = ORG_BANCO) {
  const r = await api.req(tokens.admin, 'POST', '/api/v1/admin/chaves-api', {
    nome: `${PREFIXO_NOME}${Math.random().toString(36).slice(2, 8)}`,
    organizacaoId,
    permissoes,
    ...extra
  });
  expect(r.statusCode).toBe(201);
  return r.json() as { id: string; chave: string; versao: number; prefixo: string };
}

beforeAll(async () => {
  app = await construirApp();
  await app.ready();
  api = criarCliente(() => app);
  tokens.admin = await api.login('admin', 'Admin@123');
  tokens.gestor = await api.login('gestor', 'Gestor@123');
  tokens.auditor = await api.login('auditor', 'Auditor@123');
});

afterAll(async () => {
  await prisma.chaveApi.deleteMany({ where: { nome: { startsWith: PREFIXO_NOME } } });
  await app.close();
});

describe('gestão das chaves (admin)', () => {
  it('só administrador e superusuário gerenciam chaves', async () => {
    const dados = { nome: `${PREFIXO_NOME}x`, organizacaoId: ORG_BANCO, permissoes: ['LER_RASTREABILIDADE'] };
    expect((await api.req(tokens.gestor, 'POST', '/api/v1/admin/chaves-api', dados)).statusCode).toBe(403);
    expect((await api.req(tokens.auditor, 'GET', '/api/v1/admin/chaves-api')).statusCode).toBe(403);
  });

  it('a chave completa aparece uma única vez; a listagem nunca mostra segredo nem hash', async () => {
    const criada = await criarChave(['LER_RASTREABILIDADE']);
    expect(criada.chave).toMatch(/^gck_[0-9a-f]{12}_[0-9a-f]{40}$/);
    const lista = await api.req(tokens.admin, 'GET', `/api/v1/admin/chaves-api?organizacaoId=${ORG_BANCO}`);
    const texto = lista.body;
    expect(texto).toContain(criada.prefixo);
    expect(texto).not.toContain(criada.chave);
    expect(texto).not.toContain('hashChave');
    const uma = await api.req(tokens.admin, 'GET', `/api/v1/admin/chaves-api/${criada.id}`);
    expect(uma.json()).not.toHaveProperty('chave');
  });

  it('valida os dados: permissão vazia ou desconhecida, organização inexistente', async () => {
    const base = { nome: `${PREFIXO_NOME}v`, organizacaoId: ORG_BANCO };
    expect((await api.req(tokens.admin, 'POST', '/api/v1/admin/chaves-api', { ...base, permissoes: [] })).statusCode).toBe(400);
    expect((await api.req(tokens.admin, 'POST', '/api/v1/admin/chaves-api', { ...base, permissoes: ['VOAR'] })).statusCode).toBe(400);
    const semOrg = await api.req(tokens.admin, 'POST', '/api/v1/admin/chaves-api', { ...base, organizacaoId: '00000000-0000-4000-8000-00000000ffff', permissoes: ['LER_RELATORIOS'] });
    expect(semOrg.statusCode).toBe(404);
  });
});

describe('autenticação por chave', () => {
  it('recusa chave ausente, malformada ou desconhecida (401 CHAVE_API_INVALIDA)', async () => {
    for (const chave of [undefined, 'abc', `gck_${'a'.repeat(12)}_${'b'.repeat(40)}`]) {
      const r = await pub(chave, 'GET', '/eu');
      expect(r.statusCode).toBe(401);
      expect(r.json().erro).toBe('CHAVE_API_INVALIDA');
    }
  });

  it('chave válida: identifica a organização e devolve os cabeçalhos de versão e de limite', async () => {
    const { chave } = await criarChave(['LER_RASTREABILIDADE'], { limitePorMinuto: 50 });
    const r = await pub(chave, 'GET', '/eu');
    expect(r.statusCode).toBe(200);
    expect(r.json().organizacaoId).toBe(ORG_BANCO);
    expect(r.json().permissoes).toEqual(['LER_RASTREABILIDADE']);
    expect(r.headers['x-api-version']).toBe('1');
    expect(r.headers['x-ratelimit-limit']).toBe('50');
    expect(r.headers['x-ratelimit-remaining']).toBe('49');
  });

  it('revogar bloqueia na hora e reativar libera de novo', async () => {
    const c = await criarChave(['LER_RASTREABILIDADE']);
    expect((await pub(c.chave, 'GET', '/eu')).statusCode).toBe(200);
    const off = await api.req(tokens.admin, 'PATCH', `/api/v1/admin/chaves-api/${c.id}/ativa`, { ativa: false, versao: c.versao });
    expect(off.statusCode).toBe(200);
    const negada = await pub(c.chave, 'GET', '/eu');
    expect(negada.statusCode).toBe(401);
    expect(negada.json().mensagem).toContain('revogada');
    expect((await api.req(tokens.admin, 'PATCH', `/api/v1/admin/chaves-api/${c.id}/ativa`, { ativa: true, versao: off.json().versao })).statusCode).toBe(200);
    expect((await pub(c.chave, 'GET', '/eu')).statusCode).toBe(200);
  });

  it('chave expirada é recusada', async () => {
    const c = await criarChave(['LER_RASTREABILIDADE'], { expiraEm: new Date(Date.now() + 3_600_000).toISOString() });
    expect((await pub(c.chave, 'GET', '/eu')).statusCode).toBe(200);
    await prisma.chaveApi.update({ where: { id: c.id }, data: { expiraEm: new Date(Date.now() - 1000) } });
    const r = await pub(c.chave, 'GET', '/eu');
    expect(r.statusCode).toBe(401);
    expect(r.json().mensagem).toContain('expirada');
  });

  it('rotacionar invalida a chave antiga e entrega uma nova', async () => {
    const c = await criarChave(['LER_RASTREABILIDADE']);
    const rot = await api.req(tokens.admin, 'POST', `/api/v1/admin/chaves-api/${c.id}/rotacionar`, { versao: c.versao });
    expect(rot.statusCode).toBe(200);
    expect((await pub(c.chave, 'GET', '/eu')).statusCode).toBe(401);
    expect((await pub(rot.json().chave, 'GET', '/eu')).statusCode).toBe(200);
    const velha = await api.req(tokens.admin, 'POST', `/api/v1/admin/chaves-api/${c.id}/rotacionar`, { versao: c.versao });
    expect(velha.statusCode).toBe(409); // versão desatualizada
  });
});

describe('limite de requisições por chave', () => {
  it('excede o limite da própria chave: 429, Retry-After e as outras chaves seguem livres', async () => {
    const limitada = await criarChave(['LER_RASTREABILIDADE'], { limitePorMinuto: 3 });
    const livre = await criarChave(['LER_RASTREABILIDADE']);
    for (let i = 0; i < 3; i++) expect((await pub(limitada.chave, 'GET', '/eu')).statusCode).toBe(200);
    const quarta = await pub(limitada.chave, 'GET', '/eu');
    expect(quarta.statusCode).toBe(429);
    expect(quarta.json().erro).toBe('LIMITE_DA_CHAVE');
    expect(Number(quarta.headers['retry-after'])).toBeGreaterThan(0);
    expect(quarta.headers['x-ratelimit-remaining']).toBe('0');
    expect((await pub(livre.chave, 'GET', '/eu')).statusCode).toBe(200);
  });
});

describe('permissões e isolamento entre organizações', () => {
  it('a chave só faz o que suas permissões permitem (403 SEM_PERMISSAO)', async () => {
    const { chave } = await criarChave(['LER_RASTREABILIDADE']);
    const escrever = await pub(chave, 'POST', '/lotes', { notaFiscal: 'NF-X', transportadora: 'T' });
    expect(escrever.statusCode).toBe(403);
    expect(escrever.json().erro).toBe('SEM_PERMISSAO');
    expect((await pub(chave, 'POST', '/relatorios', { tipo: 'EFICIENCIA' })).statusCode).toBe(403);
    expect((await pub(chave, 'GET', '/analises/EFICIENCIA')).statusCode).toBe(403);
  });

  it('lista, detalha e rastreia só dados da própria organização', async () => {
    const { chave } = await criarChave(['LER_RASTREABILIDADE']);
    const lotes = await pub(chave, 'GET', '/lotes');
    expect(lotes.statusCode).toBe(200);
    const itens = lotes.json() as { organizacaoId: string }[];
    expect(itens.length).toBeGreaterThan(0);
    expect(itens.every((l) => l.organizacaoId === ORG_BANCO)).toBe(true);

    expect((await pub(chave, 'GET', `/lotes/${LOTE_HOSPITAL}`)).statusCode).toBe(404);
    expect((await pub(chave, 'GET', `/rastreabilidade/${EQUIP_HOSPITAL}`)).statusCode).toBe(404);

    const rastro = await pub(chave, 'GET', `/rastreabilidade/${EQUIP_BANCO}`);
    expect(rastro.statusCode).toBe(200);
    expect(Array.isArray(rastro.json().movimentacoes)).toBe(true);
  });

  it('registra um lote sempre na organização da chave, mesmo que o corpo diga outra', async () => {
    const { chave } = await criarChave(['LER_RASTREABILIDADE', 'ESCREVER_LOTES']);
    const r = await pub(chave, 'POST', '/lotes', {
      organizacaoId: ORG_HOSPITAL,
      notaFiscal: `NF-API-${Date.now()}`,
      transportadora: 'TransApi',
      equipamentos: [{ tipo: 'NOTEBOOK', marca: 'Dell', anoFabricacao: 2019, estadoFisico: 'USADO_LEVE', pesoQuilogramas: 1.8 }]
    });
    expect(r.statusCode).toBe(201);
    expect(r.json().organizacaoId).toBe(ORG_BANCO);
    expect(r.json().equipamentos).toHaveLength(1);
    expect((await pub(chave, 'GET', `/lotes/${r.json().id}`)).statusCode).toBe(200);
  });

  it('valida o corpo (400 VALIDACAO)', async () => {
    const { chave } = await criarChave(['ESCREVER_LOTES']);
    const r = await pub(chave, 'POST', '/lotes', { transportadora: 'T' });
    expect(r.statusCode).toBe(400);
    expect(r.json().erro).toBe('VALIDACAO');
  });
});

describe('versionamento e documentação', () => {
  it('as rotas da AV2 sem prefixo continuam funcionando, marcadas como deprecadas', async () => {
    const velha = await app.inject({ method: 'GET', url: '/lotes', headers: { authorization: `Bearer ${tokens.admin}` } });
    expect(velha.statusCode).toBe(200);
    expect(velha.headers.deprecation).toBe('true');
    expect(velha.headers.sunset).toBeTruthy();
    expect(String(velha.headers.link)).toContain('successor-version');

    const nova = await api.req(tokens.admin, 'GET', '/api/v1/internal/lotes');
    expect(nova.statusCode).toBe(200);
    expect(nova.headers['x-api-version']).toBe('1');
    expect(nova.headers.deprecation).toBeUndefined();
  });

  it('o Swagger documenta a v1 (com chave de API) e esconde as rotas deprecadas', async () => {
    const spec = app.swagger() as { paths: Record<string, unknown>; components: { securitySchemes: Record<string, unknown> } };
    const caminhos = Object.keys(spec.paths);
    expect(caminhos).toContain('/api/v1/public/lotes');
    expect(caminhos).toContain('/api/v1/internal/analises/{tipo}/executar');
    expect(caminhos).toContain('/api/v1/admin/chaves-api');
    expect(caminhos).not.toContain('/lotes');
    expect(spec.components.securitySchemes).toHaveProperty('apiKey');
  });
});

// Alves aprova este código.
