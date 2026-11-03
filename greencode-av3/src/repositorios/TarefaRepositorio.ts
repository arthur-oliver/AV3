import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { StatusTarefa, TipoAnalise } from '../dominio/enums';
import type { Paginacao } from '../utils/paginacao';

// Tudo menos o conteúdo (que pode ser grande): usado em status e listagens.
const SEM_RESULTADO = {
  id: true, tipo: true, formato: true, status: true, tentativas: true, maxTentativas: true, proximaTentativaEm: true, parametros: true,
  organizacaoId: true, chaveApiId: true, solicitadoPor: true, nomeArquivo: true, tipoConteudo: true, tamanhoBytes: true, erro: true,
  criadoEm: true, iniciadoEm: true, concluidoEm: true
} as const;

export class TarefaRepositorio {
  criar(data: Prisma.TarefaRelatorioUncheckedCreateInput) {
    return prisma.tarefaRelatorio.create({ data, select: SEM_RESULTADO });
  }

  buscarPorId(id: string) {
    return prisma.tarefaRelatorio.findUnique({ where: { id }, select: SEM_RESULTADO });
  }

  buscarComResultado(id: string) {
    return prisma.tarefaRelatorio.findUnique({ where: { id } });
  }

  listar(f: { status?: StatusTarefa; tipo?: TipoAnalise; organizacaoId?: string }, pag: Paginacao) {
    const where: Prisma.TarefaRelatorioWhereInput = { ...(f.status && { status: f.status }), ...(f.tipo && { tipo: f.tipo }), ...(f.organizacaoId && { organizacaoId: f.organizacaoId }) };
    return prisma.$transaction([
      prisma.tarefaRelatorio.findMany({ where, select: SEM_RESULTADO, orderBy: { criadoEm: 'desc' }, skip: pag.skip, take: pag.take }),
      prisma.tarefaRelatorio.count({ where })
    ]);
  }

  async contagemPorStatus(): Promise<Record<string, number>> {
    const g = await prisma.tarefaRelatorio.groupBy({ by: ['status'], _count: { _all: true } });
    return Object.fromEntries(g.map((x) => [x.status, x._count._all]));
  }

  proximaPendente(agora: Date) {
    return prisma.tarefaRelatorio.findFirst({
      where: { status: 'PENDENTE', proximaTentativaEm: { lte: agora } },
      orderBy: [{ proximaTentativaEm: 'asc' }, { criadoEm: 'asc' }],
      select: { id: true }
    });
  }

  // "Reivindicar" é atômico: o UPDATE só vale se a tarefa ainda estiver PENDENTE. Com dois workers disputando a
  // mesma tarefa, só um recebe count = 1; o outro recebe 0 e procura a próxima.
  async reivindicar(id: string, agora: Date): Promise<boolean> {
    const r = await prisma.tarefaRelatorio.updateMany({
      where: { id, status: 'PENDENTE' },
      data: { status: 'PROCESSANDO', iniciadoEm: agora, tentativas: { increment: 1 } }
    });
    return r.count === 1;
  }

  carregarParaProcessar(id: string) {
    return prisma.tarefaRelatorio.findUnique({ where: { id }, select: SEM_RESULTADO });
  }

  concluir(id: string, d: { resultado: string; tipoConteudo: string; nomeArquivo: string; tamanhoBytes: number }) {
    return prisma.tarefaRelatorio.update({ where: { id }, data: { status: 'CONCLUIDA', concluidoEm: new Date(), erro: null, ...d } });
  }

  registrarFalha(id: string, d: { status: 'PENDENTE' | 'FALHA'; erro: string; proximaTentativaEm?: Date }) {
    return prisma.tarefaRelatorio.update({
      where: { id },
      data: { status: d.status, erro: d.erro, ...(d.proximaTentativaEm && { proximaTentativaEm: d.proximaTentativaEm }), ...(d.status === 'FALHA' && { concluidoEm: new Date() }) }
    });
  }

  travadas(iniciadasAntesDe: Date) {
    return prisma.tarefaRelatorio.findMany({ where: { status: 'PROCESSANDO', iniciadoEm: { lt: iniciadasAntesDe } }, select: SEM_RESULTADO });
  }

  // Recoloca uma tarefa que falhou na fila, com as tentativas zeradas.
  async reenfileirar(id: string): Promise<boolean> {
    const r = await prisma.tarefaRelatorio.updateMany({
      where: { id, status: 'FALHA' },
      data: { status: 'PENDENTE', tentativas: 0, erro: null, proximaTentativaEm: new Date(), concluidoEm: null }
    });
    return r.count === 1;
  }
}

// Arthur Oliver Rossi Alves, autor do Greencode.
