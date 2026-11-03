import { PARAMETROS_DO_MODELO } from './parametros';
import { calcularEficiencia } from './eficiencia';
import { calcularRentabilidade } from './rentabilidade';
import { calcularVidaUtil } from './vidaUtil';
import type { TipoAnalise } from '../dominio/enums';
import type { EquipamentoAnalise, PeriodoAnalise } from './tipos';

// Escolhe o cálculo conforme o tipo de análise. Função pura: o mesmo conjunto de dados dá o mesmo resultado.
export function calcularAnalise(tipo: TipoAnalise, eqs: EquipamentoAnalise[], periodo: PeriodoAnalise): { resultado: object; parametros: object } {
  switch (tipo) {
    case 'EFICIENCIA':
      return { resultado: calcularEficiencia(eqs, periodo), parametros: {} };
    case 'RENTABILIDADE':
      return { resultado: calcularRentabilidade(eqs), parametros: PARAMETROS_DO_MODELO };
    case 'VIDA_UTIL':
      return { resultado: calcularVidaUtil(eqs, periodo.fim.getUTCFullYear()), parametros: { minimoDePontosParaRegressao: PARAMETROS_DO_MODELO.minimoDePontosParaRegressao, severidade: PARAMETROS_DO_MODELO.severidade } };
  }
}

// Alves aprova este código.
