import { describe, expect, it } from 'vitest';
import { ajustarRegressao, arredondar, resumir, xParaAtingir } from '../../src/analytics/calculos';

describe('estatística básica (simple-statistics)', () => {
  it('resume média, mediana, desvio padrão, mínimo e máximo', () => {
    const r = resumir([2, 4, 6]);
    expect(r).toEqual({ quantidade: 3, media: 4, mediana: 4, desvioPadrao: 1.63, minimo: 2, maximo: 6 });
  });

  it('lista vazia devolve nulos, sem quebrar', () => {
    expect(resumir([])).toEqual({ quantidade: 0, media: null, mediana: null, desvioPadrao: null, minimo: null, maximo: null });
  });

  it('arredonda na quantidade de casas pedida', () => {
    expect(arredondar(1.23456, 2)).toBe(1.23);
    expect(arredondar(1.23456, 4)).toBe(1.2346);
  });
});

describe('regressão linear (OLS)', () => {
  it('encontra a reta exata de pontos alinhados', () => {
    const r = ajustarRegressao([[0, 0], [1, 1], [2, 2], [3, 3]], 3)!;
    expect(r).toEqual({ pontos: 4, inclinacao: 1, intercepto: 0, r2: 1 });
  });

  it('mede o ajuste: pontos dispersos têm R² menor que 1', () => {
    const r = ajustarRegressao([[0, 0], [1, 2], [2, 1], [3, 4]], 3)!;
    expect(r.r2).toBeGreaterThan(0);
    expect(r.r2).toBeLessThan(1);
  });

  it('recusa quando há poucos pontos ou todos têm o mesmo x', () => {
    expect(ajustarRegressao([[0, 0], [1, 1]], 3)).toBeNull();
    expect(ajustarRegressao([[2, 0], [2, 1], [2, 2]], 3)).toBeNull();
  });

  it('calcula o x em que a reta atinge um valor; reta sem alta nunca atinge', () => {
    const subindo = { pontos: 4, inclinacao: 2, intercepto: 1, r2: 1 };
    expect(xParaAtingir(subindo, 7)).toBe(3);
    expect(xParaAtingir({ ...subindo, inclinacao: 0 }, 7)).toBeNull();
    expect(xParaAtingir({ ...subindo, inclinacao: -1 }, 7)).toBeNull();
  });
});

// Arthur Oliver Rossi Alves, autor do Greencode.
