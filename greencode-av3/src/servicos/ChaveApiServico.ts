import { prisma } from '../lib/prisma';
import { ChaveApiRepositorio } from '../repositorios/ChaveApiRepositorio';
import { OrganizacaoRepositorio } from '../repositorios/OrganizacaoRepositorio';
import { gerarChave } from '../seguranca/chaveApi';
import { ErroValidacao, NaoEncontrado, RegraNegocio } from '../erros/AppError';
import { registrarJournal } from '../utils/auditoria';
import { exigirAtualizacao } from '../utils/versao';
import { lerPaginacao, montarPagina } from '../utils/paginacao';
import { lerData } from '../utils/datas';
import { PermissaoApi } from '../dominio/enums';
import { config } from '../config';

export interface DadosChave {
  nome: string;
  organizacaoId: string;
  permissoes: PermissaoApi[];
  limitePorMinuto?: number;
  expiraEm?: string;
}

type Chave = NonNullable<Awaited<ReturnType<ChaveApiRepositorio['buscarPorId']>>>;

// A chave em texto puro e o hash nunca saem daqui, exceto a chave recém-criada (mostrada uma única vez).
export function apresentarChave(c: Chave) {
  return {
    id: c.id,
    nome: c.nome,
    organizacaoId: c.organizacaoId,
    prefixo: c.prefixo,
    permissoes: c.permissoes as PermissaoApi[],
    limitePorMinuto: c.limitePorMinuto,
    ativa: c.ativa,
    expiraEm: c.expiraEm,
    ultimoUsoEm: c.ultimoUsoEm,
    criadoPor: c.criadoPor,
    criadoEm: c.criadoEm,
    versao: c.versao
  };
}

function validarPermissoes(p: PermissaoApi[]): PermissaoApi[] {
  const validas = new Set<string>(Object.values(PermissaoApi));
  const unicas = [...new Set(p)];
  if (unicas.length === 0 || unicas.some((x) => !validas.has(x))) throw new ErroValidacao(`Informe ao menos uma permissão válida: ${[...validas].join(', ')}.`);
  return unicas;
}

export class ChaveApiServico {
  constructor(
    private readonly chaves = new ChaveApiRepositorio(),
    private readonly organizacoes = new OrganizacaoRepositorio()
  ) {}

  async criar(d: DadosChave, usuario: string) {
    const org = await this.organizacoes.buscarPorId(d.organizacaoId);
    if (!org) throw new NaoEncontrado('Organização');
    if (!org.ativo) throw new RegraNegocio('A organização está inativa.');
    const expiraEm = d.expiraEm ? lerData(d.expiraEm, 'expiraEm') : null;
    if (expiraEm && expiraEm <= new Date()) throw new ErroValidacao('A data de expiração precisa estar no futuro.');

    const { chave, prefixo, hash } = gerarChave();
    const criada = await prisma.$transaction(async (tx) => {
      const c = await this.chaves.criar(
        { nome: d.nome, organizacaoId: d.organizacaoId, prefixo, hashChave: hash, permissoes: validarPermissoes(d.permissoes), limitePorMinuto: d.limitePorMinuto ?? config.limiteChavePadrao, expiraEm, criadoPor: usuario },
        tx
      );
      await registrarJournal(tx, { operacao: 'CRIAR', entidade: 'ChaveApi', entidadeId: c.id, dadosDepois: apresentarChave(c), usuario });
      return c;
    });
    return { ...apresentarChave(criada), chave, aviso: 'Guarde a chave agora: ela não será exibida novamente.' };
  }

  async listar(f: { organizacaoId?: string; ativa?: boolean; pagina?: number; limite?: number }) {
    const pag = lerPaginacao(f);
    const [itens, total] = await this.chaves.listar(f, pag);
    return montarPagina(itens.map(apresentarChave), total, pag);
  }

  async buscar(id: string) {
    const c = await this.chaves.buscarPorId(id);
    if (!c) throw new NaoEncontrado('Chave de API');
    return apresentarChave(c);
  }

  // Altera nome, permissões, limite ou validade (a chave em si não muda). Exige a versão atual.
  async atualizar(id: string, dados: Partial<Omit<DadosChave, 'organizacaoId'>>, versao: number, usuario: string) {
    return prisma.$transaction(async (tx) => {
      const antes = await this.chaves.buscarPorId(id, tx);
      if (!antes) throw new NaoEncontrado('Chave de API');
      const expiraEm = dados.expiraEm ? lerData(dados.expiraEm, 'expiraEm') : undefined;
      const n = await this.chaves.atualizarComVersao(
        id,
        versao,
        {
          ...(dados.nome !== undefined && { nome: dados.nome }),
          ...(dados.permissoes && { permissoes: validarPermissoes(dados.permissoes) }),
          ...(dados.limitePorMinuto !== undefined && { limitePorMinuto: dados.limitePorMinuto }),
          ...(expiraEm && { expiraEm })
        },
        tx
      );
      exigirAtualizacao(n, true, 'Chave de API');
      const depois = (await this.chaves.buscarPorId(id, tx))!;
      await registrarJournal(tx, { operacao: 'ATUALIZAR', entidade: 'ChaveApi', entidadeId: id, dadosAntes: apresentarChave(antes), dadosDepois: apresentarChave(depois), usuario });
      return apresentarChave(depois);
    });
  }

  // Revoga (ativa=false) ou reativa. Uma chave revogada é recusada na hora.
  async alterarAtiva(id: string, ativa: boolean, versao: number, usuario: string) {
    return prisma.$transaction(async (tx) => {
      const antes = await this.chaves.buscarPorId(id, tx);
      if (!antes) throw new NaoEncontrado('Chave de API');
      exigirAtualizacao(await this.chaves.atualizarComVersao(id, versao, { ativa }, tx), true, 'Chave de API');
      const depois = (await this.chaves.buscarPorId(id, tx))!;
      await registrarJournal(tx, { operacao: 'STATUS', entidade: 'ChaveApi', entidadeId: id, dadosAntes: { ativa: antes.ativa }, dadosDepois: { ativa }, usuario });
      return apresentarChave(depois);
    });
  }

  // Rotação: gera um segredo novo para a mesma chave (o antigo deixa de valer). A nova é mostrada uma vez.
  async rotacionar(id: string, versao: number, usuario: string) {
    const nova = gerarChave();
    return prisma.$transaction(async (tx) => {
      const antes = await this.chaves.buscarPorId(id, tx);
      if (!antes) throw new NaoEncontrado('Chave de API');
      exigirAtualizacao(await this.chaves.atualizarComVersao(id, versao, { prefixo: nova.prefixo, hashChave: nova.hash, ativa: true }, tx), true, 'Chave de API');
      const depois = (await this.chaves.buscarPorId(id, tx))!;
      await registrarJournal(tx, { operacao: 'ATUALIZAR', entidade: 'ChaveApi', entidadeId: id, dadosAntes: { prefixo: antes.prefixo }, dadosDepois: { prefixo: nova.prefixo, rotacionada: true }, usuario });
      return { ...apresentarChave(depois), chave: nova.chave, aviso: 'Guarde a chave agora: ela não será exibida novamente.' };
    });
  }
}

// Alves aprova este código.
