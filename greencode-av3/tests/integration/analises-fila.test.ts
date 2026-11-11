// Teste de integração da camada analítica e da fila de processamento assíncrono.
// Pré-requisitos: banco migrado e populado (npm run setup) e .env configurado.
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { TarefaWorker } from '../../src/fila/TarefaWorker';
import { FilaServico } from '../../src/servicos/FilaServico';
import { TarefaRepositorio } from '../../src/repositorios/TarefaRepositorio';
import { NaoEncontrado } from '../../src/erros/AppError';
import { criarCliente } from '../helpers/api';

const ORG_BANCO = '00000000-0000-4000-8000-0000000000a1';
const ORG_HOSPITAL = '00000000-0000-4000-8000-0000000000a2';
const PREFIXO_NOME = 'teste-';
const mudo = { info: () => undefined, error: () => undefined };

let app: FastifyInstance;
let api: ReturnType<typeof criarCliente>;
const tokens: Record<string, string> = {};
const tarefasCriadas: string[] = [];

const interno = (token: string, metodo: 'GET' | 'POST', url: string, payload?: object) => api.req(token, metodo, `/api/v1/internal${url}`, payload);
const worker = () => new TarefaWorker(mudo);
const statusDe = async (id: string) => (await interno(tokens.auditor, 'GET', `/relatorios-assincronos/${id}`)).json();

async function pedir(corpo: object) {
  const r = await interno(tokens.auditor, 'POST', '/relatorios-assincronos', corpo);
  expect(r.statusCode).toBe(202);
  tarefasCriadas.push(r.json().id);
  return r;
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
  await prisma.tarefaRelatorio.deleteMany({ where: { id: { in: tarefasCriadas } } });
  await app.close();
});

describe('camada analítica (internal)', () => {
  it('só quem tem papel de auditoria ou administração executa análises', async () => {
    expect((await interno(tokens.gestor, 'POST', '/analises/EFICIENCIA/executar', {})).statusCode).toBe(403);
    expect((await interno(tokens.auditor, 'POST', '/analises/NADA/executar', {})).statusCode).toBe(400);
  });

  it('eficiência operacional: totais, taxas, tempos e gargalo', async () => {
    const r = await interno(tokens.auditor, 'POST', '/analises/EFICIENCIA/executar', {});
    expect(r.statusCode).toBe(201);
    const a = r.json();
    expect(a.tipo).toBe('EFICIENCIA');
    expect(a.origem).toBe('MANUAL');
    expect(a.resultado.totais.equipamentos).toBeGreaterThan(20);
    expect(a.resultado.taxas.taxaConclusao).toBeGreaterThan(0);
    expect(a.resultado.tempoDeCicloHoras.quantidade).toBeGreaterThan(0);
    expect(a.resultado.porOrganizacao.length).toBeGreaterThan(1);
    expect(a.duracaoMs).toBeGreaterThan(-1);
  });

  it('rentabilidade por tipo: receita, custo e margem', async () => {
    const a = (await interno(tokens.auditor, 'POST', '/analises/RENTABILIDADE/executar', {})).json();
    expect(a.resultado.porTipo.length).toBeGreaterThan(4);
    expect(a.resultado.porTipo[0]).toHaveProperty('margemPercentual');
    expect(a.parametros).toHaveProperty('valorBasePorKg');
  });

  it('vida útil: regressão linear por tipo de equipamento', async () => {
    const a = (await interno(tokens.auditor, 'POST', '/analises/VIDA_UTIL/executar', {})).json();
    const notebook = (a.resultado.porTipo as { tipo: string; regressao: { pontos: number; r2: number } | null }[]).find((t) => t.tipo === 'NOTEBOOK')!;
    expect(notebook.regressao).not.toBeNull();
    expect(notebook.regressao!.pontos).toBeGreaterThan(2);
    expect(notebook.regressao!.r2).toBeGreaterThan(-1);
  });

  it('cada execução vira uma linha nova no histórico e a "última" devolve a mais recente', async () => {
    const antes = await interno(tokens.auditor, 'GET', '/analises/historico?tipo=EFICIENCIA&global=true&limite=1');
    const executada = (await interno(tokens.auditor, 'POST', '/analises/EFICIENCIA/executar', {})).json();
    const depois = await interno(tokens.auditor, 'GET', '/analises/historico?tipo=EFICIENCIA&global=true&limite=1');
    expect(Number(depois.headers['x-total-count'])).toBe(Number(antes.headers['x-total-count']) + 1);
    expect(depois.json()[0].id).toBe(executada.id);

    const ultima = await interno(tokens.auditor, 'GET', '/analises/EFICIENCIA/ultima');
    expect(ultima.json().id).toBe(executada.id);
    const detalhe = await interno(tokens.auditor, 'GET', `/analises/historico/${executada.id}`);
    expect(detalhe.json().resultado.totais.equipamentos).toBe(executada.resultado.totais.equipamentos);
  });

  it('análise por organização: só enxerga os dados dela e é gravada no escopo dela', async () => {
    const global = (await interno(tokens.auditor, 'POST', '/analises/EFICIENCIA/executar', {})).json();
    const org = (await interno(tokens.auditor, 'POST', '/analises/EFICIENCIA/executar', { organizacaoId: ORG_HOSPITAL })).json();
    expect(org.organizacaoId).toBe(ORG_HOSPITAL);
    expect(org.resultado.totais.equipamentos).toBeLessThan(global.resultado.totais.equipamentos);
    expect(org.resultado.porOrganizacao).toHaveLength(1);
    const hist = await interno(tokens.auditor, 'GET', `/analises/historico?organizacaoId=${ORG_HOSPITAL}`);
    expect((hist.json() as { organizacaoId: string }[]).every((h) => h.organizacaoId === ORG_HOSPITAL)).toBe(true);
    const inexistente = await interno(tokens.auditor, 'POST', '/analises/EFICIENCIA/executar', { organizacaoId: '00000000-0000-4000-8000-00000000ffff' });
    expect(inexistente.statusCode).toBe(404);
  });

  it('o agendador (mesmo trabalho do cron) grava as três análises em todos os escopos', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/v1/admin/analises/executar-agendadas', headers: { authorization: `Bearer ${tokens.admin}` } });
    expect(r.statusCode).toBe(200);
    expect(r.json().falhas).toEqual([]);
    expect(r.json().executadas).toBeGreaterThanOrEqual(12); // (global + 3 organizações) x 3 análises
    const hist = await interno(tokens.auditor, 'GET', '/analises/historico?global=true&limite=50');
    expect((hist.json() as { origem: string }[]).some((h) => h.origem === 'AGENDADA')).toBe(true);
  });
});

describe('relatórios assíncronos (internal)', () => {
  it('enfileira (202), acompanha o status e baixa o CSV quando concluído', async () => {
    const r = await pedir({ tipo: 'RENTABILIDADE', formato: 'CSV' });
    const id = r.json().id as string;
    expect(r.headers.location).toContain(id);
    expect(['PENDENTE', 'PROCESSANDO', 'CONCLUIDA']).toContain(r.json().status);

    // antes de processar: o download ainda não está disponível
    if (r.json().status === 'PENDENTE') expect((await interno(tokens.auditor, 'GET', `/relatorios-assincronos/${id}/download`)).statusCode).toBe(409);

    await worker().ciclo();
    const s = await statusDe(id);
    expect(s.status).toBe('CONCLUIDA');
    expect(s.tamanhoBytes).toBeGreaterThan(0);
    expect(s.links.download).toContain('/download');

    const arquivo = await interno(tokens.auditor, 'GET', `/relatorios-assincronos/${id}/download`);
    expect(arquivo.statusCode).toBe(200);
    expect(String(arquivo.headers['content-type'])).toContain('text/csv');
    expect(String(arquivo.headers['content-disposition'])).toContain('attachment');
    expect(arquivo.body).toContain('Tipo;Quantidade;Peso (kg)');
  });

  it('formato JSON entrega a análise completa', async () => {
    const id = (await pedir({ tipo: 'VIDA_UTIL' })).json().id as string;
    await worker().ciclo();
    const arquivo = await interno(tokens.auditor, 'GET', `/relatorios-assincronos/${id}/download`);
    expect(arquivo.statusCode).toBe(200);
    expect(JSON.parse(arquivo.body).tipo).toBe('VIDA_UTIL');
  });

  it('valida o pedido: tipo desconhecido, data inválida e organização inexistente', async () => {
    expect((await interno(tokens.auditor, 'POST', '/relatorios-assincronos', { tipo: 'X' })).statusCode).toBe(400);
    expect((await interno(tokens.auditor, 'POST', '/relatorios-assincronos', { tipo: 'EFICIENCIA', inicio: 'ontem' })).statusCode).toBe(400);
    expect((await interno(tokens.auditor, 'POST', '/relatorios-assincronos', { tipo: 'EFICIENCIA', organizacaoId: '00000000-0000-4000-8000-00000000ffff' })).statusCode).toBe(404);
    expect((await interno(tokens.gestor, 'POST', '/relatorios-assincronos', { tipo: 'EFICIENCIA' })).statusCode).toBe(403);
  });
});

describe('relatórios assíncronos pela API pública', () => {
  it('o parceiro pede, acompanha e baixa; outra organização não enxerga a tarefa', async () => {
    const criar = async (organizacaoId: string) =>
      (await api.req(tokens.admin, 'POST', '/api/v1/admin/chaves-api', { nome: `${PREFIXO_NOME}rel`, organizacaoId, permissoes: ['LER_RELATORIOS'] })).json().chave as string;
    const chaveBanco = await criar(ORG_BANCO);
    const chaveHospital = await criar(ORG_HOSPITAL);
    const pub = (chave: string, metodo: 'GET' | 'POST', url: string, payload?: object) =>
      app.inject({ method: metodo, url: `/api/v1/public${url}`, payload, headers: { 'x-api-key': chave } });

    const pedido = await pub(chaveBanco, 'POST', '/relatorios', { tipo: 'EFICIENCIA', formato: 'CSV' });
    expect(pedido.statusCode).toBe(202);
    const id = pedido.json().id as string;
    tarefasCriadas.push(id);
    expect(pedido.json().links.status).toBe(`/api/v1/public/relatorios/${id}`);

    await worker().ciclo();
    const status = await pub(chaveBanco, 'GET', `/relatorios/${id}`);
    expect(status.json().status).toBe('CONCLUIDA');
    const arquivo = await pub(chaveBanco, 'GET', `/relatorios/${id}/download`);
    expect(arquivo.statusCode).toBe(200);
    expect(arquivo.body).toContain('Indicador;Valor');

    expect((await pub(chaveHospital, 'GET', `/relatorios/${id}`)).statusCode).toBe(404);
    expect((await pub(chaveHospital, 'GET', `/relatorios/${id}/download`)).statusCode).toBe(404);

    const analise = await pub(chaveBanco, 'GET', '/analises/RENTABILIDADE');
    expect(analise.statusCode).toBe(200);
    expect(analise.json().organizacaoId).toBe(ORG_BANCO);
  });
});

describe('política de retry da fila', () => {
  const falho = (erro: Error) => new TarefaWorker(mudo, new FilaServico(), { processar: async () => { throw erro; } });
  const tornarVencida = (id: string) => prisma.tarefaRelatorio.update({ where: { id }, data: { proximaTentativaEm: new Date(Date.now() - 1000) } });

  it('falha de infraestrutura é repetida com espera crescente até esgotar as tentativas', async () => {
    const id = (await pedir({ tipo: 'EFICIENCIA' })).json().id as string;
    const w = falho(new Error('banco indisponível'));

    await w.ciclo();
    let s = await statusDe(id);
    expect(s.status).toBe('PENDENTE');
    expect(s.tentativas).toBe(1);
    expect(s.erro).toContain('banco indisponível');
    expect(new Date(s.proximaTentativaEm).getTime()).toBeGreaterThan(Date.now());

    expect(await w.ciclo()).toBe(0); // ainda não venceu a espera
    expect((await statusDe(id)).tentativas).toBe(1);

    await tornarVencida(id);
    await w.ciclo();
    expect((await statusDe(id)).tentativas).toBe(2);

    await tornarVencida(id);
    await w.ciclo();
    s = await statusDe(id);
    expect(s.status).toBe('FALHA');
    expect(s.tentativas).toBe(3);
    expect((await interno(tokens.auditor, 'GET', `/relatorios-assincronos/${id}/download`)).statusCode).toBe(409);

    // o administrador pode recolocar na fila; com o worker normal, conclui
    const re = await api.req(tokens.admin, 'POST', `/api/v1/admin/fila/tarefas/${id}/reenfileirar`);
    expect(re.statusCode).toBe(200);
    expect(re.json().status).toBe('PENDENTE');
    expect(re.json().tentativas).toBe(0);
    await worker().ciclo();
    expect((await statusDe(id)).status).toBe('CONCLUIDA');
  });

  it('erro de negócio não é repetido: falha na primeira tentativa', async () => {
    const id = (await pedir({ tipo: 'EFICIENCIA' })).json().id as string;
    await falho(new NaoEncontrado('Organização')).ciclo();
    const s = await statusDe(id);
    expect(s.status).toBe('FALHA');
    expect(s.tentativas).toBe(1);
  });

  it('só tarefas com status FALHA podem ser reenfileiradas', async () => {
    const id = (await pedir({ tipo: 'EFICIENCIA' })).json().id as string;
    await worker().ciclo();
    expect((await api.req(tokens.admin, 'POST', `/api/v1/admin/fila/tarefas/${id}/reenfileirar`)).statusCode).toBe(409);
  });

  it('tarefa travada em PROCESSANDO volta para a fila', async () => {
    const id = (await pedir({ tipo: 'EFICIENCIA' })).json().id as string;
    await prisma.tarefaRelatorio.update({ where: { id }, data: { status: 'PROCESSANDO', tentativas: 1, iniciadoEm: new Date(Date.now() - 10 * 60 * 1000) } });
    expect(await new FilaServico().recuperarTravadas()).toBeGreaterThanOrEqual(1);
    const s = await statusDe(id);
    expect(s.status).toBe('PENDENTE');
    expect(s.erro).toContain('interrompido');
  });

  it('duas disputas pela mesma tarefa: só uma a reivindica (UPDATE atômico)', async () => {
    const id = (await pedir({ tipo: 'EFICIENCIA' })).json().id as string;
    const repo = new TarefaRepositorio();
    const resultados = await Promise.all([repo.reivindicar(id, new Date()), repo.reivindicar(id, new Date()), repo.reivindicar(id, new Date())]);
    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect((await statusDe(id)).status).toBe('PROCESSANDO');
  });
});

describe('visão administrativa da fila', () => {
  it('resumo por status e listagem paginada (somente administração)', async () => {
    const resumo = await api.req(tokens.admin, 'GET', '/api/v1/admin/fila/resumo');
    expect(resumo.statusCode).toBe(200);
    expect(resumo.json().porStatus).toHaveProperty('CONCLUIDA');
    const lista = await api.req(tokens.admin, 'GET', '/api/v1/admin/fila/tarefas?status=CONCLUIDA&limite=5');
    expect(lista.statusCode).toBe(200);
    expect(Number(lista.headers['x-total-count'])).toBeGreaterThan(0);
    expect(lista.json().length).toBeLessThan(6);
    // a visão admin mostra quem pediu cada relatório
    for (const t of lista.json()) expect(typeof t.solicitadoPor).toBe('string');
    expect((await api.req(tokens.auditor, 'GET', '/api/v1/admin/fila/resumo')).statusCode).toBe(403);
  });
});

// Oliver passou por aqui.
