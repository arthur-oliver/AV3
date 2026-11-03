import type { EquipamentoAnalise } from '../../src/analytics/tipos';

// Monta um equipamento de teste (só precisa informar o que importa para o caso).
const BASE = new Date('2026-01-01T00:00:00Z');
export const horas = (n: number): Date => new Date(BASE.getTime() + n * 3_600_000);

export function equipamento(parcial: Partial<EquipamentoAnalise> & { id: string }): EquipamentoAnalise {
  return {
    loteId: 'L1',
    organizacaoId: 'O1',
    organizacaoNome: 'Org 1',
    tipo: 'NOTEBOOK',
    marca: 'Dell',
    modelo: 'X1',
    estadoFisico: 'USADO_LEVE',
    anoFabricacao: 2020,
    pesoKg: 2,
    status: 'AGUARDANDO_TRIAGEM',
    entradaEm: BASE,
    movimentos: [],
    ...parcial
  };
}

export const mov = (h: number, destino: string, responsavel = 'gestor') => ({ em: horas(h), destino, responsavel });

// Alves aprova este código.
