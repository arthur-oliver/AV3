import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import type { OrigemAnalise, TipoAnalise } from '../dominio/enums';
import type { EquipamentoAnalise } from '../analytics/tipos';
import type { Paginacao } from '../utils/paginacao';

// Escopo da análise: uma organização, ou todas (organizacaoId nulo).
const escopo = (organizacaoId?: string | null): Prisma.AnaliseResultadoWhereInput => ({ organizacaoId: organizacaoId ?? null });

export class AnaliticoRepositorio {
  // Equipamentos de lotes ATIVOS que entraram no período, já no formato que as análises usam.
  async carregarEquipamentos(f: { organizacaoId?: string | null; inicio: Date; fim: Date }): Promise<EquipamentoAnalise[]> {
    const linhas = await prisma.equipamento.findMany({
      where: { lote: { ativo: true, dataEntrada: { gte: f.inicio, lte: f.fim }, ...(f.organizacaoId && { organizacaoId: f.organizacaoId }) } },
      select: {
        id: true,
        loteId: true,
        tipo: true,
        marca: true,
        modelo: true,
        estadoFisico: true,
        anoFabricacao: true,
        pesoQuilogramas: true,
        statusRastreamento: true,
        lote: { select: { dataEntrada: true, organizacaoId: true, organizacao: { select: { razaoSocial: true } } } },
        movimentacoes: { select: { dataHora: true, destino: true, responsavel: true }, orderBy: { dataHora: 'asc' } }
      }
    });
    return linhas.map((l) => ({
      id: l.id,
      loteId: l.loteId,
      organizacaoId: l.lote.organizacaoId,
      organizacaoNome: l.lote.organizacao.razaoSocial,
      tipo: l.tipo,
      marca: l.marca,
      modelo: l.modelo,
      estadoFisico: l.estadoFisico,
      anoFabricacao: l.anoFabricacao,
      pesoKg: Number(l.pesoQuilogramas),
      status: l.statusRastreamento,
      entradaEm: l.lote.dataEntrada,
      movimentos: l.movimentacoes.map((m) => ({ em: m.dataHora, destino: m.destino, responsavel: m.responsavel }))
    }));
  }

  organizacoesAtivas() {
    return prisma.organizacao.findMany({ where: { ativo: true }, select: { id: true } });
  }

  salvar(d: {
    tipo: TipoAnalise;
    organizacaoId: string | null;
    origem: OrigemAnalise;
    solicitadoPor: string;
    periodoInicio: Date;
    periodoFim: Date;
    parametros: object;
    resultado: object;
    duracaoMs: number;
  }) {
    return prisma.analiseResultado.create({
      data: { ...d, parametros: d.parametros as Prisma.InputJsonValue, resultado: d.resultado as Prisma.InputJsonValue }
    });
  }

  buscarPorId(id: string) {
    return prisma.analiseResultado.findUnique({ where: { id } });
  }

  ultimo(tipo: TipoAnalise, organizacaoId?: string | null) {
    return prisma.analiseResultado.findFirst({ where: { tipo, ...escopo(organizacaoId) }, orderBy: { geradoEm: 'desc' } });
  }

  historico(tipo: TipoAnalise | undefined, organizacaoId: string | null | undefined, pag: Paginacao) {
    // organizacaoId undefined = qualquer escopo; null = só as globais
    const where: Prisma.AnaliseResultadoWhereInput = { ...(tipo && { tipo }), ...(organizacaoId !== undefined && escopo(organizacaoId)) };
    return prisma.$transaction([
      prisma.analiseResultado.findMany({ where, orderBy: { geradoEm: 'desc' }, skip: pag.skip, take: pag.take }),
      prisma.analiseResultado.count({ where })
    ]);
  }
}

// Alves aprova este código.
