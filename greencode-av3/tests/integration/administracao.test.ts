// Testes de integração das regras de administração: edição, exclusão e proteção do sistema.
// Roda no banco de teste (recriado a cada "npm test", ver tests/setup/bancoDeTeste.ts); basta o .env configurado.
// Cria usuários, organizações e lotes com dados realistas (tests/helpers/dados.ts). O banco do portal não é tocado.
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../src/app';
import { criarCliente } from '../helpers/api';
import { contratoVigente, novaEmpresa, novaNotaFiscal, novaPessoa, transportadora } from '../helpers/dados';
import { prisma } from '../../src/lib/prisma';

let app: FastifyInstance;
const api = criarCliente(() => app);
const { req } = api;
const tokens: Record<string, string> = {};

const SENHA = 'Senha@12345';
const NF_CORRIGIDA = 'NF-104590';
const usuariosTemporarios: string[] = []; // ids, para desativar no final

// O segundo parâmetro só descreve o caso de teste (não vira nome de nada).
async function criarUsuario(papel: string, _caso?: string) {
  const r = await req(tokens.super, 'POST', '/api/v1/admin/usuarios', { ...novaPessoa(), senha: SENHA, papel });
  expect(r.statusCode).toBe(201);
  const u = r.json() as { id: string; usuario: string; versao: number; papel: string };
  usuariosTemporarios.push(u.id);
  return u;
}

// Usuário criado pela API nasce com senha provisória (troca obrigatória). Quando o teste precisa usar o token em
// outras rotas, o fluxo de troca é pulado direto no banco; o fluxo real é testado em "troca obrigatória de senha".
const liberarTroca = (id: string) => prisma.usuario.update({ where: { id }, data: { trocaSenhaObrigatoria: false } });

// Organização com todos os campos e contrato vigente. O primeiro parâmetro só descreve o caso de teste.
const criarOrganizacao = (_caso: string, token = tokens.operador) =>
  req(token, 'POST', '/api/v1/internal/organizacoes', { ...novaEmpresa(), contrato: contratoVigente() });

const buscarUsuario = async (id: string) => (await req(tokens.super, 'GET', `/api/v1/admin/usuarios/${id}`)).json();
const buscarLote = async (id: string) => (await req(tokens.gestor, 'GET', `/api/v1/internal/lotes/${id}`)).json();
const buscarEquipamento = async (id: string) => (await req(tokens.gestor, 'GET', `/api/v1/internal/equipamentos/${id}`)).json();
const buscarOrg = async (id: string) => (await req(tokens.operador, 'GET', `/api/v1/internal/organizacoes/${id}`)).json();

beforeAll(async () => {
  app = await construirApp();
  await app.ready();
  tokens.super = await api.login('superusuario', 'Super@123');
  tokens.admin = await api.login('admin', 'Admin@123');
  tokens.operador = await api.login('operador', 'Operador@123');
  tokens.gestor = await api.login('gestor', 'Gestor@123');
  tokens.auditor = await api.login('auditor', 'Auditor@123');
});

afterAll(async () => {
  // Desativa os usuários temporários (sem erro se a regra de continuidade impedir algum caso).
  for (const id of usuariosTemporarios) {
    await req(tokens.super, 'PATCH', `/api/v1/admin/usuarios/${id}/ativo`, { ativo: false });
  }
  await app.close();
});

// ---------------------------------------------------------------------------------------------
describe('usuários: gestão de contas', () => {
  it('cria, consulta e filtra por papel', async () => {
    const u = await criarUsuario('AUDITOR', 'consulta');
    expect(u.versao).toBe(1);
    expect(u).not.toHaveProperty('senhaHash');

    const um = await req(tokens.super, 'GET', `/api/v1/admin/usuarios/${u.id}`);
    expect(um.statusCode).toBe(200);
    expect(um.json().usuario).toBe(u.usuario);

    const lista = await req(tokens.super, 'GET', '/api/v1/admin/usuarios?papel=AUDITOR&ativo=true');
    expect(lista.statusCode).toBe(200);
    expect((lista.json() as { id: string }[]).some((x) => x.id === u.id)).toBe(true);

    expect((await req(tokens.super, 'GET', '/api/v1/admin/usuarios/00000000-0000-4000-8000-00000000ffff')).statusCode).toBe(404);
  });

  it('troca o papel com versionamento otimista', async () => {
    const u = await criarUsuario('OPERADOR_CADASTRO', 'papel');

    const ok = await req(tokens.super, 'PUT', `/api/v1/admin/usuarios/${u.id}`, { papel: 'GESTOR_ALMOXARIFADO', versao: u.versao });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().papel).toBe('GESTOR_ALMOXARIFADO');
    expect(ok.json().versao).toBe(2);

    // mesma versão de novo = alguém alterou antes
    const conflito = await req(tokens.super, 'PUT', `/api/v1/admin/usuarios/${u.id}`, { papel: 'AUDITOR', versao: u.versao });
    expect(conflito.statusCode).toBe(409);

    // trocar para o papel que já tem
    const igual = await req(tokens.super, 'PUT', `/api/v1/admin/usuarios/${u.id}`, { papel: 'GESTOR_ALMOXARIFADO', versao: 2 });
    expect(igual.statusCode).toBe(422);

    // desativa no fim: um gestor temporário ativo atrapalharia o teste "não deixa o sistema sem GESTOR..."
    expect((await req(tokens.super, 'PATCH', `/api/v1/admin/usuarios/${u.id}/ativo`, { ativo: false })).statusCode).toBe(200);
  });

  it('ninguém altera o próprio papel, desativa ou exclui a própria conta', async () => {
    const eu = (await req(tokens.super, 'GET', '/api/v1/internal/auth/me')).json() as { id: string };
    const papel = await req(tokens.super, 'PUT', `/api/v1/admin/usuarios/${eu.id}`, { papel: 'AUDITOR', versao: 1 });
    expect(papel.statusCode).toBe(422);
    const desativar = await req(tokens.super, 'PATCH', `/api/v1/admin/usuarios/${eu.id}/ativo`, { ativo: false });
    expect(desativar.statusCode).toBe(422);
    const excluir = await req(tokens.super, 'DELETE', `/api/v1/admin/usuarios/${eu.id}`);
    expect(excluir.statusCode).toBe(422);
  });

  it('o superusuário redefine a senha de outro usuário', async () => {
    const u = await criarUsuario('AUDITOR', 'senha');
    expect((await api.tentarLogin(u.usuario, SENHA)).statusCode).toBe(200);

    const fraca = await req(tokens.super, 'POST', `/api/v1/admin/usuarios/${u.id}/redefinir-senha`, { novaSenha: 'abcdefgh' });
    expect(fraca.statusCode).toBe(422); // sem número

    const r = await req(tokens.super, 'POST', `/api/v1/admin/usuarios/${u.id}/redefinir-senha`, { novaSenha: 'NovaSenha@99' });
    expect(r.statusCode).toBe(204);
    expect((await api.tentarLogin(u.usuario, SENHA)).statusCode).toBe(401);
    expect((await api.tentarLogin(u.usuario, 'NovaSenha@99')).statusCode).toBe(200);
  });

  it('usuário desativado perde o acesso, inclusive com token antigo, e pode ser reativado', async () => {
    const u = await criarUsuario('AUDITOR', 'ativo');
    const token = await api.login(u.usuario, SENHA);
    expect((await req(token, 'GET', '/api/v1/internal/auth/me')).statusCode).toBe(200);

    const off = await req(tokens.super, 'PATCH', `/api/v1/admin/usuarios/${u.id}/ativo`, { ativo: false });
    expect(off.statusCode).toBe(200);
    expect(off.json().ativo).toBe(false);
    expect((await api.tentarLogin(u.usuario, SENHA)).statusCode).toBe(401);
    expect((await req(token, 'GET', '/api/v1/internal/auth/me')).statusCode).toBe(401);

    const on = await req(tokens.super, 'PATCH', `/api/v1/admin/usuarios/${u.id}/ativo`, { ativo: true });
    expect(on.json().ativo).toBe(true);
    expect((await api.tentarLogin(u.usuario, SENHA)).statusCode).toBe(200);
  });

  it('exclui apenas contas sem histórico', async () => {
    // Com histórico: já fez login, então só pode ser desativado.
    const usado = await criarUsuario('AUDITOR', 'usado');
    await api.login(usado.usuario, SENHA);
    const negado = await req(tokens.super, 'DELETE', `/api/v1/admin/usuarios/${usado.id}`);
    expect(negado.statusCode).toBe(422);
    expect(negado.json().mensagem).toContain('histórico');
    expect((await buscarUsuario(usado.id)).id).toBe(usado.id);

    // Sem histórico: criada e nunca usada.
    const novo = await criarUsuario('AUDITOR', 'novo');
    const ok = await req(tokens.super, 'DELETE', `/api/v1/admin/usuarios/${novo.id}`);
    expect(ok.statusCode).toBe(204);
    expect((await req(tokens.super, 'GET', `/api/v1/admin/usuarios/${novo.id}`)).statusCode).toBe(404);
  });

  // Regra principal: o sistema nunca fica sem administrador, operador ou gestor ativos.
  // O teste cria um usuário extra do papel, desativa-o (ainda sobra o do seed) e então tenta
  // mexer no ÚLTIMO ativo. Se o banco tiver usuários extras do papel (de testes manuais), o teste é pulado.
  async function verificarUltimoAtivo(papel: string, apelido: string, ctx: { skip: () => void }) {
    const extra = await criarUsuario(papel, apelido);
    expect((await req(tokens.super, 'PATCH', `/api/v1/admin/usuarios/${extra.id}/ativo`, { ativo: false })).statusCode).toBe(200);

    const ativos = (await req(tokens.super, 'GET', `/api/v1/admin/usuarios?papel=${papel}&ativo=true`)).json() as { id: string; versao: number }[];
    if (ativos.length !== 1) ctx.skip();
    const ultimo = ativos[0];

    const desativar = await req(tokens.super, 'PATCH', `/api/v1/admin/usuarios/${ultimo.id}/ativo`, { ativo: false });
    expect(desativar.statusCode).toBe(422);
    expect(desativar.json().mensagem).toContain('nenhum usuário ativo');

    const trocar = await req(tokens.super, 'PUT', `/api/v1/admin/usuarios/${ultimo.id}`, { papel: 'AUDITOR', versao: ultimo.versao });
    expect(trocar.statusCode).toBe(422);

    const excluir = await req(tokens.super, 'DELETE', `/api/v1/admin/usuarios/${ultimo.id}`);
    expect(excluir.statusCode).toBe(422);

    // continua ativo e no mesmo papel
    const depois = await buscarUsuario(ultimo.id);
    expect(depois.ativo).toBe(true);
    expect(depois.papel).toBe(papel);
  }

  it('não deixa o sistema sem OPERADOR_CADASTRO ativo', async (ctx) => {
    await verificarUltimoAtivo('OPERADOR_CADASTRO', 'ultimo_op', ctx);
  });

  it('não deixa o sistema sem GESTOR_ALMOXARIFADO ativo', async (ctx) => {
    await verificarUltimoAtivo('GESTOR_ALMOXARIFADO', 'ultimo_gt', ctx);
  });

  it('não deixa o sistema sem ADMINISTRADOR ativo', async (ctx) => {
    await verificarUltimoAtivo('ADMINISTRADOR', 'ultimo_adm', ctx);
  });

  it('a troca de papel vale imediatamente, mesmo com o token antigo', async () => {
    // Rota liberada ao administrador e ao operador, mas não ao auditor: DELETE de uma organização inexistente
    // responde 404 (autorizado) ou 403 (sem permissão).
    const rota = '/api/v1/internal/organizacoes/00000000-0000-4000-8000-00000000ffff?versao=1';
    const b = await criarUsuario('ADMINISTRADOR', 'adm_b');
    await liberarTroca(b.id);
    const tokenB = await api.login(b.usuario, SENHA);
    expect((await req(tokenB, 'DELETE', rota)).statusCode).toBe(404);

    // existe outro administrador ativo (o do seed), então a troca é permitida
    const r = await req(tokens.super, 'PUT', `/api/v1/admin/usuarios/${b.id}`, { papel: 'AUDITOR', versao: b.versao });
    expect(r.statusCode).toBe(200);

    // o token ainda diz "ADMINISTRADOR", mas o papel valido é o do banco
    expect((await req(tokenB, 'DELETE', rota)).statusCode).toBe(403);
    expect((await req(tokenB, 'GET', '/api/v1/internal/auth/me')).json().papel).toBe('AUDITOR');
  });

  it('bloqueia o login por 15 minutos depois de 5 senhas erradas seguidas (429)', async () => {
    const u = await criarUsuario('AUDITOR', 'forca_bruta');
    for (let i = 0; i < 5; i++) {
      expect((await api.tentarLogin(u.usuario, 'errada123')).statusCode).toBe(401);
    }
    // agora até a senha correta é recusada
    const bloqueado = await api.tentarLogin(u.usuario, SENHA);
    expect(bloqueado.statusCode).toBe(429);
    expect(bloqueado.json().erro).toBe('MUITAS_TENTATIVAS');

    // o superusuário libera ao redefinir a senha
    expect((await req(tokens.super, 'POST', `/api/v1/admin/usuarios/${u.id}/redefinir-senha`, { novaSenha: 'Liberada@123' })).statusCode).toBe(204);
    expect((await api.tentarLogin(u.usuario, 'Liberada@123')).statusCode).toBe(200);
  });

  it('só o superusuário gerencia usuários (nem o administrador)', async () => {
    const u = await criarUsuario('AUDITOR', 'permissao');
    for (const quem of ['admin', 'operador', 'gestor', 'auditor']) {
      expect((await req(tokens[quem], 'GET', '/api/v1/admin/usuarios')).statusCode).toBe(403);
      expect((await req(tokens[quem], 'GET', `/api/v1/admin/usuarios/${u.id}`)).statusCode).toBe(403);
      expect((await req(tokens[quem], 'PATCH', `/api/v1/admin/usuarios/${u.id}/nome`, { nome: 'Carlos Eduardo Pinto', versao: 1 })).statusCode).toBe(403);
      expect((await req(tokens[quem], 'PUT', `/api/v1/admin/usuarios/${u.id}`, { papel: 'GESTOR_ALMOXARIFADO', versao: 1 })).statusCode).toBe(403);
      expect((await req(tokens[quem], 'POST', `/api/v1/admin/usuarios/${u.id}/redefinir-senha`, { novaSenha: 'Qualquer@123' })).statusCode).toBe(403);
      expect((await req(tokens[quem], 'DELETE', `/api/v1/admin/usuarios/${u.id}`)).statusCode).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------------------------
describe('superusuário: único responsável pelas contas', () => {
  it('existe um único superusuário e ele aparece em /auth/me', async () => {
    const eu = (await req(tokens.super, 'GET', '/api/v1/internal/auth/me')).json();
    expect(eu.papel).toBe('SUPERUSUARIO');
    const lista = (await req(tokens.super, 'GET', '/api/v1/admin/usuarios?papel=SUPERUSUARIO')).json() as unknown[];
    expect(lista).toHaveLength(1);
  });

  it('ninguém cria nem atribui o papel SUPERUSUARIO pela API', async () => {
    const criar = await req(tokens.super, 'POST', '/api/v1/admin/usuarios', { ...novaPessoa(), senha: SENHA, papel: 'SUPERUSUARIO' });
    expect(criar.statusCode).toBe(400);
    const u = await criarUsuario('AUDITOR', 'promocao');
    const promover = await req(tokens.super, 'PUT', `/api/v1/admin/usuarios/${u.id}`, { papel: 'SUPERUSUARIO', versao: u.versao });
    expect(promover.statusCode).toBe(400);
  });

  it('o superusuário tem o maior acesso: também opera organizações, lotes, equipamentos, relatórios e auditoria', async () => {
    expect((await req(tokens.super, 'GET', '/api/v1/internal/lotes')).statusCode).toBe(200);
    expect((await req(tokens.super, 'GET', '/api/v1/internal/organizacoes')).statusCode).toBe(200);
    expect((await req(tokens.super, 'GET', '/api/v1/internal/equipamentos')).statusCode).toBe(200);
    expect((await req(tokens.super, 'GET', '/api/v1/internal/auditoria')).statusCode).toBe(200);
    expect((await req(tokens.super, 'GET', '/api/v1/internal/relatorios/financeiro')).statusCode).toBe(200);

    const org = await criarOrganizacao('Super', tokens.super);
    expect(org.statusCode).toBe(201);
    const lote = await req(tokens.super, 'POST', '/api/v1/internal/lotes', {
      organizacaoId: org.json().id,
      notaFiscal: novaNotaFiscal(),
      transportadora: transportadora(),
      equipamentos: [{ tipo: 'NOTEBOOK', anoFabricacao: 2020, pesoQuilogramas: 2 }]
    });
    expect(lote.statusCode).toBe(201);
  });

  it('o superusuário não redefine a própria senha por /usuarios (usa /auth/alterar-senha)', async () => {
    const eu = (await req(tokens.super, 'GET', '/api/v1/internal/auth/me')).json() as { id: string };
    const r = await req(tokens.super, 'POST', `/api/v1/admin/usuarios/${eu.id}/redefinir-senha`, { novaSenha: 'Outra@12345' });
    expect(r.statusCode).toBe(422);
  });

  it('altera o nome de qualquer usuário (com versão) e cada um altera o próprio nome', async () => {
    const u = await criarUsuario('AUDITOR', 'nome');
    const ok = await req(tokens.super, 'PATCH', `/api/v1/admin/usuarios/${u.id}/nome`, { nome: '  Maria   da Silva ', versao: u.versao });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().nome).toBe('Maria da Silva');
    expect(ok.json().versao).toBe(u.versao + 1);

    // versão antiga -> conflito
    const velho = await req(tokens.super, 'PATCH', `/api/v1/admin/usuarios/${u.id}/nome`, { nome: 'Mariana Silva Costa', versao: u.versao });
    expect(velho.statusCode).toBe(409);

    // o próprio usuário altera o seu nome, usando a versão de /auth/me
    await liberarTroca(u.id);
    const token = await api.login(u.usuario, SENHA);
    const eu = (await req(token, 'GET', '/api/v1/internal/auth/me')).json() as { nome: string; versao: number };
    expect(eu.nome).toBe('Maria da Silva');
    const proprio = await req(token, 'PUT', '/api/v1/internal/auth/perfil', { nome: 'Maria Souza', versao: eu.versao });
    expect(proprio.statusCode).toBe(200);
    expect((await buscarUsuario(u.id)).nome).toBe('Maria Souza');

    // nome curto demais
    expect((await req(token, 'PUT', '/api/v1/internal/auth/perfil', { nome: 'M', versao: eu.versao + 1 })).statusCode).toBe(400);
  });

  it('cada usuário troca a própria senha em /auth/alterar-senha', async () => {
    const u = await criarUsuario('AUDITOR', 'propria_senha');
    const token = await api.login(u.usuario, SENHA);
    const r = await req(token, 'POST', '/api/v1/internal/auth/alterar-senha', { senhaAtual: SENHA, novaSenha: 'Trocada@12345' });
    expect(r.statusCode).toBe(204);
    expect((await api.tentarLogin(u.usuario, 'Trocada@12345')).statusCode).toBe(200);
  });
});

// ---------------------------------------------------------------------------------------------
describe('troca obrigatória de senha no primeiro acesso', () => {
  it('usuário novo entra com a senha provisória, mas só consegue ver o perfil e trocar a senha', async () => {
    const u = await criarUsuario('GESTOR_ALMOXARIFADO', 'primeiro');
    const login = await api.tentarLogin(u.usuario, SENHA);
    expect(login.statusCode).toBe(200);
    expect(login.json().trocaSenhaObrigatoria).toBe(true);
    const token = login.json().token as string;

    // qualquer outra rota é recusada com um erro específico
    const lotes = await req(token, 'GET', '/api/v1/internal/lotes');
    expect(lotes.statusCode).toBe(403);
    expect(lotes.json().erro).toBe('TROCA_SENHA_OBRIGATORIA');
    expect((await req(token, 'PUT', '/api/v1/internal/auth/perfil', { nome: 'Carlos Eduardo Pinto', versao: 1 })).json().erro).toBe('TROCA_SENHA_OBRIGATORIA');

    // /auth/me continua liberada e informa a pendência
    const eu = await req(token, 'GET', '/api/v1/internal/auth/me');
    expect(eu.statusCode).toBe(200);
    expect(eu.json().trocaSenhaObrigatoria).toBe(true);

    // a nova senha não pode repetir a provisória, nem ser fraca, nem a atual estar errada
    expect((await req(token, 'POST', '/api/v1/internal/auth/alterar-senha', { senhaAtual: SENHA, novaSenha: SENHA })).statusCode).toBe(422);
    expect((await req(token, 'POST', '/api/v1/internal/auth/alterar-senha', { senhaAtual: SENHA, novaSenha: 'semnumero' })).statusCode).toBe(422);
    expect((await req(token, 'POST', '/api/v1/internal/auth/alterar-senha', { senhaAtual: 'errada123', novaSenha: 'Definitiva@123' })).statusCode).toBe(401);

    // troca feita: o mesmo token passa a funcionar em tudo
    expect((await req(token, 'POST', '/api/v1/internal/auth/alterar-senha', { senhaAtual: SENHA, novaSenha: 'Definitiva@123' })).statusCode).toBe(204);
    expect((await req(token, 'GET', '/api/v1/internal/lotes')).statusCode).toBe(200);
    expect((await req(token, 'GET', '/api/v1/internal/auth/me')).json().trocaSenhaObrigatoria).toBe(false);

    // a senha provisória deixa de valer; no próximo login não há mais pendência
    expect((await api.tentarLogin(u.usuario, SENHA)).statusCode).toBe(401);
    const depois = await api.tentarLogin(u.usuario, 'Definitiva@123');
    expect(depois.statusCode).toBe(200);
    expect(depois.json().trocaSenhaObrigatoria).toBe(false);
  });

  it('quando o superusuário redefine a senha de alguém, a troca volta a ser obrigatória', async () => {
    const u = await criarUsuario('AUDITOR', 'reset_troca');
    await liberarTroca(u.id);
    const antes = await api.login(u.usuario, SENHA);
    expect((await req(antes, 'GET', '/api/v1/internal/lotes')).statusCode).toBe(200);

    expect((await req(tokens.super, 'POST', `/api/v1/admin/usuarios/${u.id}/redefinir-senha`, { novaSenha: 'Provisoria@1' })).statusCode).toBe(204);
    // mesmo o token antigo fica restrito até a troca
    expect((await req(antes, 'GET', '/api/v1/internal/lotes')).json().erro).toBe('TROCA_SENHA_OBRIGATORIA');
    const novo = await api.tentarLogin(u.usuario, 'Provisoria@1');
    expect(novo.json().trocaSenhaObrigatoria).toBe(true);
  });

  it('a lista de usuários mostra quem ainda não trocou a senha provisória', async () => {
    const u = await criarUsuario('AUDITOR', 'lista_troca');
    const dados = await buscarUsuario(u.id);
    expect(dados.trocaSenhaObrigatoria).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
describe('relatórios em CSV', () => {
  it('?formato=csv baixa o arquivo; sem o parâmetro continua JSON', async () => {
    for (const url of ['/api/v1/internal/relatorios/financeiro', '/api/v1/internal/relatorios/status/AGUARDANDO_TRIAGEM', '/api/v1/internal/auditoria?limite=5']) {
      const csv = await req(tokens.auditor, 'GET', `${url}${url.includes('?') ? '&' : '?'}formato=csv`);
      expect(csv.statusCode).toBe(200);
      expect(csv.headers['content-type']).toContain('text/csv');
      expect(csv.headers['content-disposition']).toContain('attachment; filename=');
      expect(csv.body.startsWith('\uFEFF')).toBe(true);
      expect(csv.body).toContain(';');

      const json = await req(tokens.auditor, 'GET', url);
      expect(json.headers['content-type']).toContain('application/json');
    }
  });

  it('o CSV respeita as mesmas permissões e valida o formato', async () => {
    const sem = await app.inject({ method: 'GET', url: '/api/v1/internal/auditoria?formato=csv' });
    expect(sem.statusCode).toBe(401);
    expect((await req(tokens.gestor, 'GET', '/api/v1/internal/auditoria?formato=csv')).statusCode).toBe(403);
    expect((await req(tokens.auditor, 'GET', '/api/v1/internal/relatorios/financeiro?formato=xml')).statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------------------------
describe('lotes e equipamentos: correção e exclusão', () => {
  let orgId = '';
  let loteId = '';
  let eqIds: string[] = [];

  beforeAll(async () => {
    const org = await req(tokens.operador, 'POST', '/api/v1/internal/organizacoes', {
      ...novaEmpresa(),
      contrato: contratoVigente(500)
    });
    expect(org.statusCode).toBe(201);
    orgId = org.json().id;

    const lote = await req(tokens.gestor, 'POST', '/api/v1/internal/lotes', {
      organizacaoId: orgId,
      notaFiscal: novaNotaFiscal(),
      transportadora: transportadora(),
      equipamentos: [
        { tipo: 'NOTEBOOK', marca: 'Dell', anoFabricacao: 2020, pesoQuilogramas: 2 },
        { tipo: 'MONITOR', marca: 'LG', anoFabricacao: 2019, pesoQuilogramas: 3 },
        { tipo: 'IMPRESSORA', marca: 'HP', anoFabricacao: 2018, pesoQuilogramas: 5 }
      ]
    });
    expect(lote.statusCode).toBe(201);
    loteId = lote.json().id;
    eqIds = (lote.json().equipamentos as { id: string }[]).map((e) => e.id);
  });

  it('corrige nota fiscal, transportadora e observações do lote', async () => {
    const antes = await buscarLote(loteId);
    const r = await req(tokens.gestor, 'PUT', `/api/v1/internal/lotes/${loteId}`, {
      notaFiscal: NF_CORRIGIDA,
      transportadora: 'Expresso Nordeste',
      observacoes: 'Nota fiscal corrigida após conferência com o cliente.',
      versao: antes.versao
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().notaFiscal).toBe(NF_CORRIGIDA);
    expect(r.json().versao).toBe(antes.versao + 1);

    // versão antiga: conflito
    const conflito = await req(tokens.gestor, 'PUT', `/api/v1/internal/lotes/${loteId}`, { notaFiscal: 'NF-104577', versao: antes.versao });
    expect(conflito.statusCode).toBe(409);
  });

  it('valida a correção do lote (campo vazio e data de entrada)', async () => {
    const lote = await buscarLote(loteId);
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/lotes/${loteId}`, { versao: lote.versao })).statusCode).toBe(400);
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/lotes/${loteId}`, { dataEntrada: '2099-01-01', versao: lote.versao })).statusCode).toBe(400);
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/lotes/${loteId}`, { dataEntrada: '2020-01-01', versao: lote.versao })).statusCode).toBe(400);

    const hoje = new Date().toISOString().slice(0, 10);
    const ok = await req(tokens.gestor, 'PUT', `/api/v1/internal/lotes/${loteId}`, { dataEntrada: hoje, versao: lote.versao });
    expect(ok.statusCode).toBe(200);
  });

  it('corrige os dados cadastrais de um equipamento', async () => {
    const antes = await buscarEquipamento(eqIds[0]);
    const r = await req(tokens.gestor, 'PUT', `/api/v1/internal/equipamentos/${eqIds[0]}`, { marca: 'Lenovo', modelo: 'ThinkPad T480', pesoQuilogramas: 1.75, versao: antes.versao });
    expect(r.statusCode).toBe(200);
    expect(r.json().marca).toBe('Lenovo');
    expect(Number(r.json().pesoQuilogramas)).toBe(1.75);
    expect(r.json().codigoBarrasInterno).toBe(antes.codigoBarrasInterno); // o código nunca muda
    expect(r.json().versao).toBe(antes.versao + 1);

    // versão desatualizada, campo vazio, ano absurdo e peso inválido
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/equipamentos/${eqIds[0]}`, { marca: 'Acer', versao: antes.versao })).statusCode).toBe(409);
    const atual = await buscarEquipamento(eqIds[0]);
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/equipamentos/${eqIds[0]}`, { versao: atual.versao })).statusCode).toBe(400);
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/equipamentos/${eqIds[0]}`, { anoFabricacao: 2099, versao: atual.versao })).statusCode).toBe(400);
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/equipamentos/${eqIds[0]}`, { pesoQuilogramas: 0, versao: atual.versao })).statusCode).toBe(400);
  });

  it('a correção fica registrada no journal com o antes e o depois', async () => {
    const r = await req(tokens.auditor, 'GET', `/api/v1/internal/auditoria?entidade=Equipamento&entidadeId=${eqIds[0]}`);
    const registros = r.json().registros as { operacao: string; dadosAntes: Record<string, unknown> | null; dadosDepois: Record<string, unknown> | null }[];
    const edicao = registros.find((x) => x.operacao === 'ATUALIZAR' && x.dadosDepois?.marca === 'Lenovo');
    expect(edicao).toBeDefined();
    expect(edicao!.dadosAntes?.marca).toBe('Dell');
  });

  it('exclui um equipamento antes da triagem e registra a exclusão', async () => {
    const eq = await buscarEquipamento(eqIds[2]);

    // versão desatualizada
    expect((await req(tokens.gestor, 'DELETE', `/api/v1/internal/equipamentos/${eqIds[2]}?versao=${eq.versao + 5}`)).statusCode).toBe(409);
    // sem informar a versão
    expect((await req(tokens.gestor, 'DELETE', `/api/v1/internal/equipamentos/${eqIds[2]}`)).statusCode).toBe(400);

    const ok = await req(tokens.gestor, 'DELETE', `/api/v1/internal/equipamentos/${eqIds[2]}?versao=${eq.versao}`);
    expect(ok.statusCode).toBe(204);
    expect((await req(tokens.gestor, 'GET', `/api/v1/internal/equipamentos/${eqIds[2]}`)).statusCode).toBe(404);
    expect((await buscarLote(loteId)).equipamentos).toHaveLength(2);

    const journal = (await req(tokens.auditor, 'GET', `/api/v1/internal/auditoria?entidade=Equipamento&entidadeId=${eqIds[2]}`)).json().registros as { operacao: string }[];
    expect(journal.some((x) => x.operacao === 'EXCLUIR')).toBe(true);
  });

  it('exclui um lote inteiro (com equipamentos) antes da triagem', async () => {
    const lote = await req(tokens.gestor, 'POST', '/api/v1/internal/lotes', {
      organizacaoId: orgId,
      notaFiscal: novaNotaFiscal(),
      transportadora: transportadora(),
      equipamentos: [{ tipo: 'ROTEADOR', anoFabricacao: 2021, pesoQuilogramas: 1 }]
    });
    const { id, versao } = lote.json() as { id: string; versao: number };

    expect((await req(tokens.gestor, 'DELETE', `/api/v1/internal/lotes/${id}?versao=${versao + 3}`)).statusCode).toBe(409);
    const ok = await req(tokens.gestor, 'DELETE', `/api/v1/internal/lotes/${id}?versao=${versao}`);
    expect(ok.statusCode).toBe(204);

    expect((await req(tokens.gestor, 'GET', `/api/v1/internal/lotes/${id}`)).statusCode).toBe(404);
    expect((await req(tokens.gestor, 'GET', `/api/v1/internal/equipamentos?loteId=${id}`)).json()).toEqual([]);
    const journal = (await req(tokens.auditor, 'GET', `/api/v1/internal/auditoria?entidade=Lote&entidadeId=${id}`)).json().registros as { operacao: string }[];
    expect(journal.some((x) => x.operacao === 'EXCLUIR')).toBe(true);
  });

  it('depois da triagem, a data de entrada não pode mais ser alterada (nota fiscal e observações sim)', async () => {
    const antes = await buscarLote(loteId);
    expect((await req(tokens.gestor, 'POST', `/api/v1/internal/lotes/${loteId}/triagem`, { versao: antes.versao })).statusCode).toBe(200);

    const lote = await buscarLote(loteId);
    const hoje = new Date().toISOString().slice(0, 10);
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/lotes/${loteId}`, { dataEntrada: hoje, versao: lote.versao })).statusCode).toBe(422);
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/lotes/${loteId}`, { observacoes: 'Peso dos equipamentos revisado após a triagem.', versao: lote.versao })).statusCode).toBe(200);
  });

  it('respeita as permissões por papel', async () => {
    const lote = await buscarLote(loteId);
    const eq = await buscarEquipamento(eqIds[0]);
    for (const quem of ['auditor', 'operador']) {
      expect((await req(tokens[quem], 'PUT', `/api/v1/internal/lotes/${loteId}`, { notaFiscal: 'NF-104577', versao: lote.versao })).statusCode).toBe(403);
      expect((await req(tokens[quem], 'DELETE', `/api/v1/internal/lotes/${loteId}?versao=${lote.versao}`)).statusCode).toBe(403);
      expect((await req(tokens[quem], 'PUT', `/api/v1/internal/equipamentos/${eqIds[0]}`, { marca: 'Positivo', versao: eq.versao })).statusCode).toBe(403);
      expect((await req(tokens[quem], 'DELETE', `/api/v1/internal/equipamentos/${eqIds[0]}?versao=${eq.versao}`)).statusCode).toBe(403);
    }
  });

  it('o contrato pode ser removido mesmo com lotes em aberto; sem contrato ativo a organização não recebe novo lote', async () => {
    const org = await buscarOrg(orgId);
    const contrato = await req(tokens.operador, 'DELETE', `/api/v1/internal/organizacoes/${orgId}/contrato?versao=${org.contrato.versao}`);
    expect(contrato.statusCode).toBe(200);

    const novo = await req(tokens.gestor, 'POST', '/api/v1/internal/lotes', { organizacaoId: orgId, notaFiscal: novaNotaFiscal(), transportadora: transportadora() });
    expect(novo.statusCode).toBe(422);
    expect((await buscarLote(loteId)).id).toBe(loteId); // o lote que já existia continua lá
  });
});

// ---------------------------------------------------------------------------------------------
describe('organizações e contratos: exclusão', () => {
  it('exclui organização sem lotes (e o contrato dela) e registra no journal', async () => {
    const r = await criarOrganizacao('Cadastro errado', tokens.operador);
    const org = r.json() as { id: string; versao: number; contrato: { id: string } };

    expect((await req(tokens.operador, 'DELETE', `/api/v1/internal/organizacoes/${org.id}?versao=${org.versao + 4}`)).statusCode).toBe(409);
    expect((await req(tokens.operador, 'DELETE', `/api/v1/internal/organizacoes/${org.id}`)).statusCode).toBe(400);
    expect((await req(tokens.gestor, 'DELETE', `/api/v1/internal/organizacoes/${org.id}?versao=${org.versao}`)).statusCode).toBe(403);

    const ok = await req(tokens.operador, 'DELETE', `/api/v1/internal/organizacoes/${org.id}?versao=${org.versao}`);
    expect(ok.statusCode).toBe(204);
    expect((await req(tokens.operador, 'GET', `/api/v1/internal/organizacoes/${org.id}`)).statusCode).toBe(404);

    const journal = (await req(tokens.auditor, 'GET', `/api/v1/internal/auditoria?entidade=Organizacao&entidadeId=${org.id}`)).json().registros as { operacao: string }[];
    expect(journal.some((x) => x.operacao === 'EXCLUIR')).toBe(true);
    const jContrato = (await req(tokens.auditor, 'GET', `/api/v1/internal/auditoria?entidade=Contrato&entidadeId=${org.contrato.id}`)).json().registros as { operacao: string }[];
    expect(jContrato.some((x) => x.operacao === 'EXCLUIR')).toBe(true);
  });

  it('remove o contrato de uma organização sem lotes em aberto', async () => {
    const r = await criarOrganizacao('Sem contrato', tokens.operador);
    const org = r.json() as { id: string; contrato: { versao: number } };

    expect((await req(tokens.operador, 'DELETE', `/api/v1/internal/organizacoes/${org.id}/contrato?versao=${org.contrato.versao + 3}`)).statusCode).toBe(409);

    const ok = await req(tokens.operador, 'DELETE', `/api/v1/internal/organizacoes/${org.id}/contrato?versao=${org.contrato.versao}`);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().contrato).toBeNull();
    expect(ok.json().contratoVigente).toBe(false);

    // não há mais contrato para remover
    expect((await req(tokens.operador, 'DELETE', `/api/v1/internal/organizacoes/${org.id}/contrato?versao=1`)).statusCode).toBe(422);
  });
});

// ---------------------------------------------------------------------------------------------
describe('soft delete e exclusão em cadeia', () => {
  async function criarCenario(rotulo: string) {
    const org = await criarOrganizacao(rotulo);
    expect(org.statusCode).toBe(201);
    const orgId = org.json().id as string;
    const lotes: { id: string; eqIds: string[] }[] = [];
    for (let n = 0; n < 2; n++) {
      const l = await req(tokens.gestor, 'POST', '/api/v1/internal/lotes', {
        organizacaoId: orgId,
        notaFiscal: novaNotaFiscal(),
        transportadora: transportadora(),
        equipamentos: [
          { tipo: 'NOTEBOOK', anoFabricacao: 2020, pesoQuilogramas: 2 },
          { tipo: 'MONITOR', anoFabricacao: 2019, pesoQuilogramas: 3 }
        ]
      });
      expect(l.statusCode).toBe(201);
      lotes.push({ id: l.json().id, eqIds: (l.json().equipamentos as { id: string }[]).map((e) => e.id) });
    }
    return { orgId, lotes };
  }

  it('inativar um lote (soft delete) mantém os dados, bloqueia alterações e permite reativar', async () => {
    const { orgId, lotes } = await criarCenario('SoftLote');
    const lote = await buscarLote(lotes[0].id);

    // sem versão / versão errada / sem permissão
    expect((await req(tokens.gestor, 'PATCH', `/api/v1/internal/lotes/${lote.id}/ativo`, { ativo: false })).statusCode).toBe(400);
    expect((await req(tokens.gestor, 'PATCH', `/api/v1/internal/lotes/${lote.id}/ativo`, { ativo: false, versao: lote.versao + 4 })).statusCode).toBe(409);
    expect((await req(tokens.operador, 'PATCH', `/api/v1/internal/lotes/${lote.id}/ativo`, { ativo: false, versao: lote.versao })).statusCode).toBe(403);

    const off = await req(tokens.gestor, 'PATCH', `/api/v1/internal/lotes/${lote.id}/ativo`, { ativo: false, versao: lote.versao });
    expect(off.statusCode).toBe(200);
    expect(off.json().ativo).toBe(false);
    expect(off.json().equipamentos).toHaveLength(2); // continua no banco

    // listagem filtra por ativo
    const inativos = (await req(tokens.gestor, 'GET', `/api/v1/internal/lotes?organizacaoId=${orgId}&ativo=false`)).json() as { id: string }[];
    expect(inativos.map((l) => l.id)).toEqual([lote.id]);
    const ativos = (await req(tokens.gestor, 'GET', `/api/v1/internal/lotes?organizacaoId=${orgId}&ativo=true`)).json() as { id: string }[];
    expect(ativos.map((l) => l.id)).not.toContain(lote.id);

    // lote e equipamentos inativos não aceitam alteração (422)
    const inativo = await buscarLote(lote.id);
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/lotes/${lote.id}`, { notaFiscal: 'NF-104577', versao: inativo.versao })).statusCode).toBe(422);
    expect((await req(tokens.gestor, 'POST', `/api/v1/internal/lotes/${lote.id}/triagem`, { versao: inativo.versao })).statusCode).toBe(422);
    const eq = await buscarEquipamento(lotes[0].eqIds[0]);
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/equipamentos/${eq.id}`, { marca: 'Positivo', versao: eq.versao })).statusCode).toBe(422);

    // reativa e volta a aceitar alterações
    const on = await req(tokens.gestor, 'PATCH', `/api/v1/internal/lotes/${lote.id}/ativo`, { ativo: true, versao: inativo.versao });
    expect(on.statusCode).toBe(200);
    expect(on.json().ativo).toBe(true);
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/lotes/${lote.id}`, { notaFiscal: 'NF-104578', versao: on.json().versao })).statusCode).toBe(200);

    const journal = (await req(tokens.auditor, 'GET', `/api/v1/internal/auditoria?entidade=Lote&entidadeId=${lote.id}`)).json().registros as { operacao: string }[];
    expect(journal.filter((j) => j.operacao === 'ATUALIZAR').length).toBeGreaterThanOrEqual(2);
  });

  it('exclusão definitiva do lote em qualquer status remove também os equipamentos', async () => {
    const { lotes } = await criarCenario('HardLote');
    const lote = await buscarLote(lotes[0].id);
    expect((await req(tokens.gestor, 'POST', `/api/v1/internal/lotes/${lote.id}/triagem`, { versao: lote.versao })).statusCode).toBe(200);

    const depois = await buscarLote(lote.id); // já em TRIAGEM_CONCLUIDA
    expect((await req(tokens.gestor, 'DELETE', `/api/v1/internal/lotes/${lote.id}?versao=${depois.versao}`)).statusCode).toBe(204);
    expect((await req(tokens.gestor, 'GET', `/api/v1/internal/lotes/${lote.id}`)).statusCode).toBe(404);
    for (const id of lotes[0].eqIds) expect((await req(tokens.gestor, 'GET', `/api/v1/internal/equipamentos/${id}`)).statusCode).toBe(404);
    // o outro lote da organização não é afetado
    expect((await req(tokens.gestor, 'GET', `/api/v1/internal/lotes/${lotes[1].id}`)).statusCode).toBe(200);
  });

  it('exclusão definitiva do equipamento vale em qualquer fase (depois da triagem também)', async () => {
    const { lotes } = await criarCenario('HardEq');
    const lote = await buscarLote(lotes[0].id);
    expect((await req(tokens.gestor, 'POST', `/api/v1/internal/lotes/${lote.id}/triagem`, { versao: lote.versao })).statusCode).toBe(200);

    const eq = await buscarEquipamento(lotes[0].eqIds[0]);
    expect((await req(tokens.gestor, 'DELETE', `/api/v1/internal/equipamentos/${eq.id}?versao=${eq.versao}`)).statusCode).toBe(204);
    expect((await req(tokens.gestor, 'GET', `/api/v1/internal/equipamentos/${eq.id}`)).statusCode).toBe(404);
  });

  it('inativar a organização inativa em cadeia os lotes e equipamentos, mesmo com contrato ativo e lotes em aberto', async () => {
    const { orgId, lotes } = await criarCenario('SoftOrg');
    const org = await buscarOrg(orgId);
    expect(org.contratoVigente).toBe(true);

    const off = await req(tokens.operador, 'PATCH', `/api/v1/internal/organizacoes/${orgId}/ativo`, { ativo: false, versao: org.versao });
    expect(off.statusCode).toBe(200);
    expect(off.json().ativo).toBe(false);

    for (const l of lotes) {
      const lote = await buscarLote(l.id);
      expect(lote.ativo).toBe(false);
      expect(lote.equipamentos).toHaveLength(2); // nada foi apagado
    }
    const eq = await buscarEquipamento(lotes[0].eqIds[0]);
    expect((await req(tokens.gestor, 'PUT', `/api/v1/internal/equipamentos/${eq.id}`, { marca: 'Positivo', versao: eq.versao })).statusCode).toBe(422);
    // organização inativa não recebe lote
    expect((await req(tokens.gestor, 'POST', '/api/v1/internal/lotes', { organizacaoId: orgId, notaFiscal: novaNotaFiscal(), transportadora: transportadora() })).statusCode).toBe(422);

    // reativar a organização não reativa os lotes; e um lote só volta com a organização ativa
    const lote = await buscarLote(lotes[0].id);
    expect((await req(tokens.gestor, 'PATCH', `/api/v1/internal/lotes/${lote.id}/ativo`, { ativo: true, versao: lote.versao })).statusCode).toBe(422);
    const inativa = await buscarOrg(orgId);
    expect((await req(tokens.operador, 'PATCH', `/api/v1/internal/organizacoes/${orgId}/ativo`, { ativo: true, versao: inativa.versao })).statusCode).toBe(200);
    expect((await buscarLote(lotes[1].id)).ativo).toBe(false);
    expect((await req(tokens.gestor, 'PATCH', `/api/v1/internal/lotes/${lote.id}/ativo`, { ativo: true, versao: lote.versao })).statusCode).toBe(200);
  });

  it('excluir a organização remove em cadeia contrato, lotes, equipamentos e registra tudo no journal', async () => {
    const { orgId, lotes } = await criarCenario('HardOrg');
    const org = await buscarOrg(orgId);
    const contratoId = org.contrato.id as string;

    expect((await req(tokens.operador, 'DELETE', `/api/v1/internal/organizacoes/${orgId}?versao=${org.versao + 3}`)).statusCode).toBe(409);
    expect((await req(tokens.gestor, 'DELETE', `/api/v1/internal/organizacoes/${orgId}?versao=${org.versao}`)).statusCode).toBe(403);
    // a tentativa com versão errada não pode ter apagado nada (transação)
    expect((await req(tokens.gestor, 'GET', `/api/v1/internal/lotes/${lotes[0].id}`)).statusCode).toBe(200);

    expect((await req(tokens.operador, 'DELETE', `/api/v1/internal/organizacoes/${orgId}?versao=${org.versao}`)).statusCode).toBe(204);
    expect((await req(tokens.operador, 'GET', `/api/v1/internal/organizacoes/${orgId}`)).statusCode).toBe(404);
    for (const l of lotes) {
      expect((await req(tokens.gestor, 'GET', `/api/v1/internal/lotes/${l.id}`)).statusCode).toBe(404);
      for (const id of l.eqIds) expect((await req(tokens.gestor, 'GET', `/api/v1/internal/equipamentos/${id}`)).statusCode).toBe(404);
    }

    const excluidos = async (entidade: string, id: string) =>
      ((await req(tokens.auditor, 'GET', `/api/v1/internal/auditoria?entidade=${entidade}&entidadeId=${id}`)).json().registros as { operacao: string }[]).some((j) => j.operacao === 'EXCLUIR');
    expect(await excluidos('Organizacao', orgId)).toBe(true);
    expect(await excluidos('Contrato', contratoId)).toBe(true);
    expect(await excluidos('Lote', lotes[0].id)).toBe(true);
    expect(await excluidos('Equipamento', lotes[1].eqIds[1])).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------
describe('status do lote derivado dos equipamentos', () => {
  async function loteComDoisEquipamentos(rotulo: string) {
    const org = await criarOrganizacao(rotulo);
    const l = await req(tokens.gestor, 'POST', '/api/v1/internal/lotes', {
      organizacaoId: org.json().id,
      notaFiscal: novaNotaFiscal(),
      transportadora: transportadora(),
      equipamentos: [
        { tipo: 'NOTEBOOK', anoFabricacao: 2020, pesoQuilogramas: 2 },
        { tipo: 'MONITOR', anoFabricacao: 2019, pesoQuilogramas: 3 }
      ]
    });
    expect(l.statusCode).toBe(201);
    const lote = l.json();
    return { id: lote.id as string, versao: lote.versao as number, eq: (lote.equipamentos as { id: string }[]).map((e) => e.id) };
  }

  async function mudar(eqId: string, status: string) {
    const e = await buscarEquipamento(eqId);
    const r = await req(tokens.gestor, 'PATCH', `/api/v1/internal/equipamentos/${eqId}/status`, { status, justificativa: 'teste', versao: e.versao });
    expect(r.statusCode).toBe(200);
  }

  it('o lote só muda de status quando todos os equipamentos têm o mesmo status', async () => {
    const lote = await loteComDoisEquipamentos('Derivado');
    expect((await req(tokens.gestor, 'POST', `/api/v1/internal/lotes/${lote.id}/triagem`, { versao: lote.versao })).statusCode).toBe(200);
    expect((await buscarLote(lote.id)).statusProcessamento).toBe('TRIAGEM_CONCLUIDA');

    // só o primeiro equipamento avança: status misturados, o lote não muda
    await mudar(lote.eq[0], 'AGUARDANDO_DESMONTE');
    expect((await buscarLote(lote.id)).statusProcessamento).toBe('TRIAGEM_CONCLUIDA');

    // o segundo chega ao mesmo status: o lote passa a ENCAMINHADO
    await mudar(lote.eq[1], 'AGUARDANDO_DESMONTE');
    expect((await buscarLote(lote.id)).statusProcessamento).toBe('ENCAMINHADO');

    // percorre o resto do caminho; o lote só finaliza quando os dois estiverem em BAIXA_DEFINITIVA
    for (const eq of lote.eq) await mudar(eq, 'EM_DESMONTE');
    await mudar(lote.eq[0], 'MATERIAL_RECICLAVEL');
    await mudar(lote.eq[1], 'DESCARTE_SEGURO');
    await mudar(lote.eq[0], 'BAIXA_DEFINITIVA');
    expect((await buscarLote(lote.id)).statusProcessamento).toBe('ENCAMINHADO');
    await mudar(lote.eq[1], 'BAIXA_DEFINITIVA');
    expect((await buscarLote(lote.id)).statusProcessamento).toBe('FINALIZADO');

    // a mudança de status do lote fica no journal
    const journal = (await req(tokens.auditor, 'GET', `/api/v1/internal/auditoria?entidade=Lote&entidadeId=${lote.id}`)).json().registros as { operacao: string }[];
    expect(journal.filter((j) => j.operacao === 'STATUS').length).toBeGreaterThanOrEqual(3);
  });

  it('não existe mais rota para mudar o status do lote à mão', async () => {
    const lote = await loteComDoisEquipamentos('SemRota');
    expect((await req(tokens.gestor, 'PATCH', `/api/v1/internal/lotes/${lote.id}/status`, { status: 'ENCAMINHADO', versao: lote.versao })).statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------------------------
describe('paginação, relatórios e código de barras', () => {
  it('as listagens aceitam ?pagina= e ?limite= e informam o total nos cabeçalhos', async () => {
    const todos = await req(tokens.gestor, 'GET', '/api/v1/internal/equipamentos?limite=500');
    const total = Number(todos.headers['x-total-count']);
    expect(total).toBeGreaterThan(0);

    const pagina = await req(tokens.gestor, 'GET', '/api/v1/internal/equipamentos?pagina=1&limite=2');
    expect(pagina.statusCode).toBe(200);
    expect((pagina.json() as unknown[]).length).toBeLessThanOrEqual(2);
    expect(pagina.headers['x-total-count']).toBe(String(total));
    expect(pagina.headers['x-limite']).toBe('2');

    expect((await req(tokens.gestor, 'GET', '/api/v1/internal/equipamentos?limite=0')).statusCode).toBe(400);
    expect((await req(tokens.gestor, 'GET', '/api/v1/internal/equipamentos?limite=9999')).statusCode).toBe(400);
    expect((await req(tokens.operador, 'GET', '/api/v1/internal/organizacoes?pagina=1&limite=1')).statusCode).toBe(200);
    expect((await req(tokens.gestor, 'GET', '/api/v1/internal/lotes?pagina=1&limite=1')).statusCode).toBe(200);
    expect((await req(tokens.super, 'GET', '/api/v1/admin/usuarios?pagina=1&limite=1')).statusCode).toBe(200);
  });

  it('relatórios ignoram lotes inativos, a menos que ?incluirInativos=true', async () => {
    const org = await criarOrganizacao('Relatório', tokens.operador);
    const orgId = org.json().id as string;
    const l = await req(tokens.gestor, 'POST', '/api/v1/internal/lotes', {
      organizacaoId: orgId,
      notaFiscal: novaNotaFiscal(),
      transportadora: transportadora(),
      equipamentos: [{ tipo: 'NOTEBOOK', anoFabricacao: 2020, pesoQuilogramas: 2 }]
    });
    const lote = l.json() as { id: string; versao: number };

    const antes = (await req(tokens.auditor, 'GET', `/api/v1/internal/relatorios/organizacao/${orgId}`)).json();
    expect(antes.totalLotes).toBe(1);

    expect((await req(tokens.gestor, 'PATCH', `/api/v1/internal/lotes/${lote.id}/ativo`, { ativo: false, versao: lote.versao })).statusCode).toBe(200);

    const sem = (await req(tokens.auditor, 'GET', `/api/v1/internal/relatorios/organizacao/${orgId}`)).json();
    expect(sem.totalLotes).toBe(0);
    const com = (await req(tokens.auditor, 'GET', `/api/v1/internal/relatorios/organizacao/${orgId}?incluirInativos=true`)).json();
    expect(com.totalLotes).toBe(1);

    // o relatório por status segue a mesma regra
    expect((await req(tokens.auditor, 'GET', '/api/v1/internal/relatorios/status/AGUARDANDO_TRIAGEM')).json().incluiInativos).toBe(false);
    expect((await req(tokens.auditor, 'GET', '/api/v1/internal/relatorios/status/AGUARDANDO_TRIAGEM?incluirInativos=true')).json().incluiInativos).toBe(true);
  });

  it('o código de barras do equipamento é o próprio id e não pode ser informado', async () => {
    const org = await criarOrganizacao('Barras', tokens.operador);
    const l = await req(tokens.gestor, 'POST', '/api/v1/internal/lotes', {
      organizacaoId: org.json().id,
      notaFiscal: novaNotaFiscal(),
      transportadora: transportadora(),
      equipamentos: [{ codigoBarrasInterno: 'ETQ-2026-000431', tipo: 'NOTEBOOK', anoFabricacao: 2020, pesoQuilogramas: 2 }]
    });
    expect(l.statusCode).toBe(201);
    const e = l.json().equipamentos[0] as { id: string; codigoBarrasInterno: string };
    expect(e.codigoBarrasInterno).toBe(e.id);
    expect(e.codigoBarrasInterno).not.toBe('ETQ-2026-000431');
  });
});

// escrito com carinho por Arthur.
