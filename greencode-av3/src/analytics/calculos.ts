import { linearRegression, mean, median, rSquared, standardDeviation } from 'simple-statistics';

// Funções estatísticas puras (sem banco). Usam a biblioteca simple-statistics para média, mediana, desvio
// padrão e regressão linear (mínimos quadrados ordinários).

export const arredondar = (n: number, casas = 2): number => Math.round(n * 10 ** casas) / 10 ** casas;

export interface ResumoNumerico {
  quantidade: number;
  media: number | null;
  mediana: number | null;
  desvioPadrao: number | null;
  minimo: number | null;
  maximo: number | null;
}

export function resumir(valores: number[], casas = 2): ResumoNumerico {
  if (valores.length === 0) return { quantidade: 0, media: null, mediana: null, desvioPadrao: null, minimo: null, maximo: null };
  return {
    quantidade: valores.length,
    media: arredondar(mean(valores), casas),
    mediana: arredondar(median(valores), casas),
    desvioPadrao: arredondar(standardDeviation(valores), casas),
    minimo: arredondar(Math.min(...valores), casas),
    maximo: arredondar(Math.max(...valores), casas)
  };
}

export interface Regressao {
  pontos: number;
  inclinacao: number;
  intercepto: number;
  r2: number;
}

// Ajusta y = inclinacao * x + intercepto pelos mínimos quadrados. Devolve null quando não há dados suficientes
// (poucos pontos ou todos com o mesmo x, caso em que a reta não existe).
export function ajustarRegressao(pontos: [number, number][], minimoDePontos: number): Regressao | null {
  if (pontos.length < minimoDePontos) return null;
  if (new Set(pontos.map((p) => p[0])).size < 2) return null;
  const { m, b } = linearRegression(pontos);
  if (!Number.isFinite(m) || !Number.isFinite(b)) return null;
  const r2 = rSquared(pontos, (x) => m * x + b);
  return { pontos: pontos.length, inclinacao: arredondar(m, 4), intercepto: arredondar(b, 4), r2: arredondar(Number.isFinite(r2) ? r2 : 0, 4) };
}

// Valor de x em que a reta atinge o valor y indicado (ex.: a idade em que o desgaste chega a "inservível").
// Reta sem tendência de alta (inclinação <= 0) nunca chega lá: devolve null.
export function xParaAtingir(reg: Regressao, y: number): number | null {
  if (reg.inclinacao <= 0) return null;
  return (y - reg.intercepto) / reg.inclinacao;
}

// escrito com carinho por Arthur.
