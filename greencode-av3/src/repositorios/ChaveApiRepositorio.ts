import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { Paginacao } from '../utils/paginacao';

type Cliente = Prisma.TransactionClient;

export class ChaveApiRepositorio {
  criar(data: Prisma.ChaveApiUncheckedCreateInput, tx: Cliente = prisma) {
    return tx.chaveApi.create({ data });
  }

  buscarPorId(id: string, tx: Cliente = prisma) {
    return tx.chaveApi.findUnique({ where: { id } });
  }

  buscarPorPrefixo(prefixo: string) {
    return prisma.chaveApi.findUnique({ where: { prefixo } });
  }

  listar(f: { organizacaoId?: string; ativa?: boolean }, pag: Paginacao) {
    const where: Prisma.ChaveApiWhereInput = { ...(f.organizacaoId && { organizacaoId: f.organizacaoId }), ...(f.ativa !== undefined && { ativa: f.ativa }) };
    return prisma.$transaction([
      prisma.chaveApi.findMany({ where, orderBy: { criadoEm: 'desc' }, skip: pag.skip, take: pag.take }),
      prisma.chaveApi.count({ where })
    ]);
  }

  async atualizarComVersao(id: string, versao: number, data: Prisma.ChaveApiUpdateManyMutationInput, tx: Cliente = prisma) {
    const r = await tx.chaveApi.updateMany({ where: { id, versao }, data: { ...data, versao: { increment: 1 } } });
    return r.count;
  }

  registrarUso(id: string) {
    return prisma.chaveApi.update({ where: { id }, data: { ultimoUsoEm: new Date() } });
  }
}

// escrito com carinho por Arthur.
