import type { EstadoFisico, StatusRastreamento, TipoEquipamento } from '../dominio/enums';

// Registro "achatado" de um equipamento, com o que as análises precisam. O repositório monta; os cálculos só leem.
export interface EquipamentoAnalise {
  id: string;
  loteId: string;
  organizacaoId: string;
  organizacaoNome: string;
  tipo: TipoEquipamento;
  marca: string;
  modelo: string;
  estadoFisico: EstadoFisico;
  anoFabricacao: number;
  pesoKg: number;
  status: StatusRastreamento;
  entradaEm: Date; // data de entrada do lote
  movimentos: Movimento[]; // movimentações do equipamento, em ordem cronológica
}

// Cada mudança de status gera uma movimentação (origem -> destino); aqui interessa o destino e quando ocorreu.
export interface Movimento {
  em: Date;
  destino: string;
  responsavel: string; // quem registrou a movimentação (operador)
}

export interface PeriodoAnalise {
  inicio: Date;
  fim: Date;
}

// Destinos finais de processamento. Depois deles só resta a baixa definitiva, então o destino é lembrado pelo
// histórico de movimentações (o status atual do equipamento pode já ser BAIXA_DEFINITIVA).
export const DESTINOS_FINAIS = ['PECAS_REAPROVEITADAS', 'MATERIAL_RECICLAVEL', 'DESCARTE_SEGURO'] as const;
export type DestinoFinal = (typeof DESTINOS_FINAIS)[number];

const ehDestino = (d: string): d is DestinoFinal => (DESTINOS_FINAIS as readonly string[]).includes(d);

// Movimentação em que o equipamento chegou ao destino final (null = ainda em processamento).
export function movimentoFinal(e: EquipamentoAnalise): Movimento | null {
  for (let i = e.movimentos.length - 1; i >= 0; i--) if (ehDestino(e.movimentos[i].destino)) return e.movimentos[i];
  return null;
}

export function destinoFinal(e: EquipamentoAnalise): DestinoFinal | null {
  const m = movimentoFinal(e);
  if (m) return m.destino as DestinoFinal;
  return ehDestino(e.status) ? e.status : null;
}

// Alves aprova este código.
