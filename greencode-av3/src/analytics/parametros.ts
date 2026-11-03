import { EstadoFisico, TipoEquipamento } from '../dominio/enums';

// Parâmetros do modelo de rentabilidade e de vida útil. Ficam aqui (e são devolvidos junto com cada resultado)
// para que qualquer número do relatório possa ser reproduzido. São valores de referência, ajustáveis.

// Valor de referência do material recuperável, em R$ por kg, para um equipamento em ESTADO NOVO.
export const VALOR_BASE_POR_KG: Record<TipoEquipamento, number> = {
  NOTEBOOK: 18,
  COMPUTADOR_MESA: 9,
  MONITOR: 6,
  IMPRESSORA: 4,
  SERVIDOR: 14,
  ROTEADOR: 12,
  CABO_ESTRUTURADO: 5,
  FONTE_ALIMENTACAO: 7
};

// Quanto do valor se mantém conforme o estado físico (1 = novo; quanto pior o estado, menos se recupera).
export const FATOR_ESTADO: Record<EstadoFisico, number> = {
  NOVO: 1,
  BOM_ESTADO: 0.9,
  USADO_LEVE: 0.75,
  USADO_MODERADO: 0.6,
  DANIFICADO_LEVE: 0.4,
  DANIFICADO_GRAVE: 0.2,
  INSERVIVEL: 0.1
};

// Custo de processar um equipamento: por kg, fixo por unidade e adicional por kg quando o destino é descarte seguro.
export const CUSTO_PROCESSAMENTO_POR_KG = 1.5;
export const CUSTO_FIXO_POR_EQUIPAMENTO = 2.5;
export const CUSTO_DESCARTE_SEGURO_POR_KG = 3;

// Marcas com componentes mais valorizados no mercado de reaproveitamento ganham um acréscimo.
export const MARCAS_PREMIUM = ['DELL', 'HP', 'LENOVO', 'APPLE', 'CISCO', 'IBM'];
export const FATOR_MARCA_PREMIUM = 1.15;

// Severidade do desgaste: posição do estado físico na lista (NOVO = 0 ... INSERVIVEL = 6).
// É a variável que a regressão tenta explicar pela idade do equipamento.
export const SEVERIDADE: Record<EstadoFisico, number> = Object.fromEntries(
  Object.values(EstadoFisico).map((e, i) => [e, i])
) as Record<EstadoFisico, number>;
export const SEVERIDADE_INSERVIVEL = SEVERIDADE.INSERVIVEL;

// Mínimo de equipamentos de um tipo para a regressão ser considerada confiável o bastante para projetar.
export const MIN_PONTOS_REGRESSAO = 3;

export function fatorMarca(marca: string): number {
  return MARCAS_PREMIUM.includes(marca.trim().toUpperCase()) ? FATOR_MARCA_PREMIUM : 1;
}

// Valor estimado de recuperação (R$) de um equipamento: peso x valor por kg x fator do estado x fator da marca.
export function valorEstimadoDeRecuperacao(e: { tipo: TipoEquipamento; estadoFisico: EstadoFisico; marca: string; pesoQuilogramas: unknown }): number {
  const bruto = Number(e.pesoQuilogramas) * VALOR_BASE_POR_KG[e.tipo] * FATOR_ESTADO[e.estadoFisico] * fatorMarca(e.marca);
  return Math.round(bruto * 100) / 100;
}

export const PARAMETROS_DO_MODELO = {
  valorBasePorKg: VALOR_BASE_POR_KG,
  fatorEstado: FATOR_ESTADO,
  marcasPremium: MARCAS_PREMIUM,
  fatorMarcaPremium: FATOR_MARCA_PREMIUM,
  custoProcessamentoPorKg: CUSTO_PROCESSAMENTO_POR_KG,
  custoFixoPorEquipamento: CUSTO_FIXO_POR_EQUIPAMENTO,
  custoDescarteSeguroPorKg: CUSTO_DESCARTE_SEGURO_POR_KG,
  severidade: SEVERIDADE,
  minimoDePontosParaRegressao: MIN_PONTOS_REGRESSAO
};

// Arthur Oliver Rossi Alves, autor do Greencode.
