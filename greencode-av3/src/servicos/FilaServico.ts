import { TarefaRepositorio } from '../repositorios/TarefaRepositorio';
import { OrganizacaoRepositorio } from '../repositorios/OrganizacaoRepositorio';
import { AppError, Conflito, NaoEncontrado } from '../erros/AppError';
import { decidirAposFalha, esperaDoRetry } from '../regras/retry';
import { intervalo } from '../utils/datas';
import { lerPaginacao, montarPagina } from '../utils/paginacao';
import { config } from '../config';
import type { FormatoRelatorio, StatusTarefa, TipoAnalise } from '../dominio/enums';

type Tarefa = NonNullable<Awaited<ReturnType<TarefaRepositorio['buscarPorId']>>>;

export interface PedidoRelatorio {
  tipo: TipoAnalise;
  formato: FormatoRelatorio;
  organizacaoId?: string | null;
  chaveApiId?: string | null;
  solicitadoPor: string;
  inicio?: string;
  fim?: string;
}

// O que o worker precisa da fila (a interface facilita testar o worker sem banco).
export interface PortaFila {
  reivindicarProxima(): Promise<Tarefa | null>;
  concluir(id: string, saida: { conteudo: string; tipoConteudo: string; nomeArquivo: string; tamanhoBytes: number }): Promise<void>;
  registrarFalha(tarefa: Tarefa, erro: unknown): Promise<void>;
  recuperarTravadas(): Promise<number>;
}

// Formato de uma tarefa nas respostas: links prontos para consultar e baixar.
export function apresentarTarefa(t: Tarefa, base: string) {
  return {
    id: t.id,
    tipo: t.tipo,
    formato: t.formato,
    status: t.status,
    tentativas: t.tentativas,
    maxTentativas: t.maxTentativas,
    proximaTentativaEm: t.status === 'PENDENTE' && t.tentativas > 0 ? t.proximaTentativaEm : null,
    erro: t.erro,
    nomeArquivo: t.nomeArquivo,
    tamanhoBytes: t.tamanhoBytes,
    criadoEm: t.criadoEm,
    iniciadoEm: t.iniciadoEm,
    concluidoEm: t.concluidoEm,
    links: { status: `${base}/${t.id}`, download: t.status === 'CONCLUIDA' ? `${base}/${t.id}/download` : null }
  };
}

export class FilaServico implements PortaFila {
  constructor(
    private readonly tarefas = new TarefaRepositorio(),
    private readonly organizacoes = new OrganizacaoRepositorio()
  ) {}

  // --- lado da API ---

  async enfileirar(p: PedidoRelatorio) {
    intervalo(p.inicio, p.fim); // datas inválidas falham agora (400), e não só depois no worker
    if (p.organizacaoId && !(await this.organizacoes.buscarPorId(p.organizacaoId))) throw new NaoEncontrado('Organização');
    return this.tarefas.criar({
      tipo: p.tipo,
      formato: p.formato,
      organizacaoId: p.organizacaoId ?? null,
      chaveApiId: p.chaveApiId ?? null,
      solicitadoPor: p.solicitadoPor,
      parametros: { inicio: p.inicio ?? null, fim: p.fim ?? null },
      maxTentativas: config.tarefaMaxTentativas
    });
  }

  // Com "organizacaoId" (API pública) a tarefa só é visível para a organização dona: as demais veem 404.
  async consultar(id: string, organizacaoId?: string) {
    const t = await this.tarefas.buscarPorId(id);
    if (!t || (organizacaoId && t.organizacaoId !== organizacaoId)) throw new NaoEncontrado('Tarefa');
    return t;
  }

  async baixar(id: string, organizacaoId?: string) {
    await this.consultar(id, organizacaoId);
    const t = await this.tarefas.buscarComResultado(id);
    if (!t) throw new NaoEncontrado('Tarefa');
    if (t.status !== 'CONCLUIDA' || t.resultado === null) {
      throw new Conflito(t.status === 'FALHA' ? 'A tarefa falhou e não gerou arquivo.' : `O relatório ainda não está pronto (status ${t.status}).`);
    }
    return { conteudo: t.resultado, tipoConteudo: t.tipoConteudo ?? 'application/json', nomeArquivo: t.nomeArquivo ?? `relatorio-${t.id}` };
  }

  async listar(f: { status?: StatusTarefa; tipo?: TipoAnalise; organizacaoId?: string; pagina?: number; limite?: number }) {
    const pag = lerPaginacao(f);
    const [itens, total] = await this.tarefas.listar(f, pag);
    return montarPagina(itens, total, pag);
  }

  async resumo() {
    return this.tarefas.contagemPorStatus();
  }

  async reenfileirar(id: string) {
    await this.consultar(id);
    if (!(await this.tarefas.reenfileirar(id))) throw new Conflito('Só tarefas com status FALHA podem ser reenfileiradas.');
    return this.consultar(id);
  }

  // --- lado do worker ---

  async reivindicarProxima(): Promise<Tarefa | null> {
    for (let i = 0; i < 5; i++) {
      const candidata = await this.tarefas.proximaPendente(new Date());
      if (!candidata) return null;
      if (await this.tarefas.reivindicar(candidata.id, new Date())) return this.tarefas.carregarParaProcessar(candidata.id);
      // outro worker pegou primeiro: tenta a próxima
    }
    return null;
  }

  async concluir(id: string, saida: { conteudo: string; tipoConteudo: string; nomeArquivo: string; tamanhoBytes: number }) {
    await this.tarefas.concluir(id, { resultado: saida.conteudo, tipoConteudo: saida.tipoConteudo, nomeArquivo: saida.nomeArquivo, tamanhoBytes: saida.tamanhoBytes });
  }

  // Aplica a política de retry (ver regras/retry.ts). Erro de negócio não é repetido.
  async registrarFalha(tarefa: Tarefa, erro: unknown, repetivel = !(erro instanceof AppError)) {
    const mensagem = (erro instanceof Error ? erro.message : String(erro)).slice(0, 1000);
    if (decidirAposFalha(tarefa.tentativas, tarefa.maxTentativas, repetivel) === 'TENTAR_NOVAMENTE') {
      const quando = new Date(Date.now() + esperaDoRetry(tarefa.tentativas, config.tarefaBackoffBaseMs));
      await this.tarefas.registrarFalha(tarefa.id, { status: 'PENDENTE', erro: mensagem, proximaTentativaEm: quando });
    } else {
      await this.tarefas.registrarFalha(tarefa.id, { status: 'FALHA', erro: mensagem });
    }
  }

  // Tarefa "PROCESSANDO" há tempo demais = worker caiu no meio. Volta para a fila (ou falha, se as tentativas acabaram).
  async recuperarTravadas(): Promise<number> {
    const limite = new Date(Date.now() - config.tarefaTravadaAposMs);
    const travadas = await this.tarefas.travadas(limite);
    for (const t of travadas) await this.registrarFalha(t, new Error('Processamento interrompido (tempo excedido).'), true);
    return travadas.length;
  }
}

// Oliver passou por aqui.
