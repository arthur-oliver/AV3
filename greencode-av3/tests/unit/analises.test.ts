import { describe, expect, it } from 'vitest';
import { calcularEficiencia } from '../../src/analytics/eficiencia';
import { calcularRentabilidade } from '../../src/analytics/rentabilidade';
import { calcularVidaUtil } from '../../src/analytics/vidaUtil';
import { calcularAnalise } from '../../src/analytics/motor';
import { resultadoParaCsv } from '../../src/analytics/exportacao';
import { valorEstimadoDeRecuperacao } from '../../src/analytics/parametros';
import { equipamento, horas, mov } from '../helpers/equipamentos';

const periodo = { inicio: horas(0), fim: horas(24 * 10) };

// A: peças reaproveitadas (e já baixado)  B: reciclável  C: descarte seguro  D, E: ainda em triagem
const base = [
  equipamento({ id: 'A', status: 'BAIXA_DEFINITIVA', movimentos: [mov(1, 'AGUARDANDO_TRIAGEM'), mov(10, 'EM_TRIAGEM'), mov(20, 'AGUARDANDO_DESMONTE'), mov(30, 'EM_DESMONTE'), mov(50, 'PECAS_REAPROVEITADAS'), mov(60, 'BAIXA_DEFINITIVA')] }),
  equipamento({ id: 'B', status: 'MATERIAL_RECICLAVEL', movimentos: [mov(1, 'AGUARDANDO_TRIAGEM'), mov(5, 'EM_TRIAGEM'), mov(20, 'MATERIAL_RECICLAVEL')] }),
  equipamento({ id: 'C', status: 'DESCARTE_SEGURO', movimentos: [mov(1, 'AGUARDANDO_TRIAGEM'), mov(8, 'EM_TRIAGEM'), mov(30, 'DESCARTE_SEGURO')] }),
  equipamento({ id: 'D', status: 'EM_TRIAGEM', movimentos: [mov(1, 'AGUARDANDO_TRIAGEM'), mov(4, 'EM_TRIAGEM')] }),
  equipamento({ id: 'E', status: 'EM_TRIAGEM', movimentos: [mov(1, 'AGUARDANDO_TRIAGEM'), mov(6, 'EM_TRIAGEM')] })
];

describe('eficiência operacional', () => {
  const r = calcularEficiencia(base, periodo);

  it('conta totais e concluídos (o destino final vem do histórico, mesmo após a baixa)', () => {
    expect(r.totais.equipamentos).toBe(5);
    expect(r.totais.concluidos).toBe(3);
    expect(r.totais.lotes).toBe(1);
    expect(r.totais.pesoKg).toBe(10);
  });

  it('calcula as taxas', () => {
    expect(r.taxas.taxaConclusao).toBe(60);
    expect(r.taxas.aproveitamento).toBe(66.7);
    expect(r.taxas.reaproveitadosPct).toBe(33.3);
    expect(r.taxas.recicladosPct).toBe(33.3);
    expect(r.taxas.descartePct).toBe(33.3);
    expect(r.indiceDeEficiencia).toBeGreaterThan(63);
    expect(r.indiceDeEficiencia).toBeLessThan(64);
  });

  it('calcula os tempos em horas', () => {
    expect(r.tempoAtePrimeiraMovimentacaoHoras.media).toBe(1);
    expect(r.tempoDeCicloHoras.quantidade).toBe(3);
    expect(r.tempoDeCicloHoras.media).toBe(33.33);
    expect(r.tempoDeCicloHoras.minimo).toBe(20);
    expect(r.tempoDeCicloHoras.maximo).toBe(50);
  });

  it('aponta o gargalo: o status em aberto com mais equipamentos', () => {
    expect(r.gargalo).toEqual({ status: 'EM_TRIAGEM', quantidade: 2, percentualDoTotal: 40 });
    expect(r.distribuicaoPorStatus.EM_TRIAGEM).toBe(2);
  });

  it('triagem por lote: da entrada até o último equipamento sair da triagem (só lotes concluídos)', () => {
    // lote L1 tem D e E ainda em triagem -> não conta; L2 terminou: saídas em 20 h e 30 h -> 30 h
    const eqs = [
      ...base,
      equipamento({ id: 'F', loteId: 'L2', status: 'MATERIAL_RECICLAVEL', movimentos: [mov(1, 'AGUARDANDO_TRIAGEM'), mov(5, 'EM_TRIAGEM'), mov(20, 'MATERIAL_RECICLAVEL')] }),
      equipamento({ id: 'G', loteId: 'L2', status: 'DESCARTE_SEGURO', movimentos: [mov(1, 'AGUARDANDO_TRIAGEM'), mov(8, 'EM_TRIAGEM'), mov(30, 'DESCARTE_SEGURO')] })
    ];
    const t = calcularEficiencia(eqs, periodo).triagemDosLotes;
    expect(t.lotesAvaliados).toBe(2);
    expect(t.lotesComTriagemConcluida).toBe(1);
    expect(t.horas.media).toBe(30);
  });

  it('compara operadores e etapas: tempo de cada etapa vai para quem a encerrou', () => {
    const eqs = [
      equipamento({ id: 'P', status: 'MATERIAL_RECICLAVEL', movimentos: [mov(1, 'AGUARDANDO_TRIAGEM', 'ana'), mov(5, 'EM_TRIAGEM', 'ana'), mov(15, 'MATERIAL_RECICLAVEL', 'bruno')] }),
      equipamento({ id: 'Q', status: 'EM_TRIAGEM', movimentos: [mov(1, 'AGUARDANDO_TRIAGEM', 'ana'), mov(9, 'EM_TRIAGEM', 'ana')] })
    ];
    const r = calcularEficiencia(eqs, periodo);
    const op = (n: string) => r.porOperador.find((o) => o.operador === n)!;
    expect(op('ana').movimentacoes).toBe(2); // recebimento não conta
    expect(op('ana').tempoMedioPorEtapaHoras).toBe(6); // (4 + 8) / 2
    expect(op('bruno').tempoMedioPorEtapaHoras).toBe(10);
    expect(r.etapaMaisLenta).toEqual({ etapa: 'MATERIAL_RECICLAVEL', ocorrencias: 1, tempoMedioHoras: 10 });
  });

  it('agrupa por mês de entrada para mostrar variação ao longo do ano', () => {
    const jan = new Date('2026-01-10T00:00:00Z');
    const mar = new Date('2026-03-10T00:00:00Z');
    const eqs = [
      equipamento({ id: 'J', loteId: 'LJ', entradaEm: jan }),
      equipamento({ id: 'M1', loteId: 'LM', entradaEm: mar }),
      equipamento({ id: 'M2', loteId: 'LM', entradaEm: mar })
    ];
    const p = calcularEficiencia(eqs, periodo).porPeriodo;
    expect(p.map((x) => [x.periodo, x.lotes, x.equipamentos])).toEqual([['2026-01', 1, 1], ['2026-03', 1, 2]]);
  });

  it('sem dados, devolve nulos em vez de dividir por zero', () => {
    const vazio = calcularEficiencia([], periodo);
    expect(vazio.totais.equipamentos).toBe(0);
    expect(vazio.taxas.taxaConclusao).toBeNull();
    expect(vazio.indiceDeEficiencia).toBeNull();
    expect(vazio.gargalo).toBeNull();
  });
});

describe('rentabilidade por tipo', () => {
  const eqs = [
    equipamento({ id: '1', tipo: 'NOTEBOOK', marca: 'Dell', estadoFisico: 'NOVO', pesoKg: 2 }),
    equipamento({ id: '2', tipo: 'MONITOR', marca: 'LG', estadoFisico: 'BOM_ESTADO', pesoKg: 3 }),
    equipamento({ id: '3', tipo: 'SERVIDOR', marca: 'X', estadoFisico: 'INSERVIVEL', pesoKg: 10, status: 'DESCARTE_SEGURO', movimentos: [mov(1, 'DESCARTE_SEGURO')] })
  ];
  const r = calcularRentabilidade(eqs);
  const tipo = (t: string) => r.porTipo.find((x) => x.tipo === t)!;

  it('valor de recuperação = peso x valor/kg x estado x marca', () => {
    expect(valorEstimadoDeRecuperacao({ tipo: 'NOTEBOOK', estadoFisico: 'NOVO', marca: 'dell', pesoQuilogramas: 2 })).toBeCloseTo(41.4, 2);
    expect(valorEstimadoDeRecuperacao({ tipo: 'MONITOR', estadoFisico: 'BOM_ESTADO', marca: 'LG', pesoQuilogramas: 3 })).toBeCloseTo(16.2, 2);
  });

  it('calcula receita, custo e margem de cada tipo', () => {
    expect(tipo('NOTEBOOK').receitaEstimada).toBeCloseTo(41.4, 2);
    expect(tipo('NOTEBOOK').custoEstimado).toBeCloseTo(5.5, 2);
    expect(tipo('NOTEBOOK').margem).toBeCloseTo(35.9, 2);
    expect(tipo('MONITOR').margem).toBeCloseTo(9.2, 2);
  });

  it('descarte seguro custa mais e pode dar margem negativa', () => {
    expect(tipo('SERVIDOR').custoEstimado).toBeCloseTo(47.5, 2);
    expect(tipo('SERVIDOR').margem).toBeCloseTo(-33.5, 2);
  });

  it('também ranqueia marcas e modelos pela margem média por equipamento', () => {
    const rk = calcularRentabilidade([
      equipamento({ id: 'a', tipo: 'NOTEBOOK', marca: 'Dell', modelo: 'L1', estadoFisico: 'BOM_ESTADO', pesoKg: 2 }),
      equipamento({ id: 'b', tipo: 'NOTEBOOK', marca: 'Dell', modelo: 'L1', estadoFisico: 'BOM_ESTADO', pesoKg: 2 }),
      equipamento({ id: 'c', tipo: 'MONITOR', marca: 'Xyz', modelo: 'M9', estadoFisico: 'USADO_MODERADO', pesoKg: 3 })
    ]);
    expect(rk.porMarca[0].marca).toBe('Dell');
    expect(rk.porMarca[0].quantidade).toBe(2);
    expect(rk.porModelo.map((m) => m.modelo)).toEqual(['Dell L1', 'Xyz M9']);
  });

  it('ordena por margem e aponta o mais e o menos rentável', () => {
    expect(r.porTipo.map((t) => t.tipo)).toEqual(['NOTEBOOK', 'MONITOR', 'SERVIDOR']);
    expect(r.maisRentavel).toBe('NOTEBOOK');
    expect(r.menosRentavel).toBe('SERVIDOR');
    expect(r.totais.margem).toBeCloseTo(11.6, 2);
  });
});

describe('vida útil restante (regressão linear)', () => {
  // idade 0, 2, 4, 6 anos com desgaste 0, 1, 2, 3 -> reta exata: desgaste = 0,5 x idade
  const notebooks = [
    equipamento({ id: 'n0', anoFabricacao: 2026, estadoFisico: 'NOVO' }),
    equipamento({ id: 'n2', anoFabricacao: 2024, estadoFisico: 'BOM_ESTADO' }),
    equipamento({ id: 'n4', anoFabricacao: 2022, estadoFisico: 'USADO_LEVE' }),
    equipamento({ id: 'n6', anoFabricacao: 2020, estadoFisico: 'USADO_MODERADO' })
  ];

  it('ajusta a reta e projeta a idade em que o equipamento fica inservível', () => {
    const t = calcularVidaUtil(notebooks, 2026).porTipo[0];
    expect(t.regressao).toEqual({ pontos: 4, inclinacao: 0.5, intercepto: 0, r2: 1 });
    expect(t.confianca).toBe('ALTA');
    expect(t.idadeLimiteAnos).toBe(12);
    expect(t.vidaRestanteMediaAnos).toBe(9);
  });

  it('as previsões vêm ordenadas da menor vida restante para a maior', () => {
    const p = calcularVidaUtil(notebooks, 2026).porTipo[0].previsoes;
    expect(p.map((x) => x.equipamentoId)).toEqual(['n6', 'n4', 'n2', 'n0']);
    expect(p[0].vidaRestanteAnos).toBe(6);
    expect(p[0].severidadeEsperada).toBe(3);
  });

  it('explica quando não dá para projetar (poucos dados ou sem tendência de desgaste)', () => {
    const poucos = calcularVidaUtil([equipamento({ id: 'm1', tipo: 'MONITOR' }), equipamento({ id: 'm2', tipo: 'MONITOR', anoFabricacao: 2018 })], 2026).porTipo[0];
    expect(poucos.regressao).toBeNull();
    expect(poucos.observacao).toContain('insuficientes');

    const plano = ['2026', '2024', '2022'].map((ano, i) => equipamento({ id: `r${i}`, tipo: 'ROTEADOR', anoFabricacao: Number(ano), estadoFisico: 'USADO_MODERADO' }));
    const semTendencia = calcularVidaUtil(plano, 2026).porTipo[0];
    expect(semTendencia.idadeLimiteAnos).toBeNull();
    expect(semTendencia.observacao).toContain('desgaste crescente');
  });
});

describe('motor e exportação CSV', () => {
  it('o motor escolhe o cálculo pelo tipo e devolve os parâmetros usados', () => {
    const r = calcularAnalise('RENTABILIDADE', base, periodo);
    expect(r.parametros).toHaveProperty('valorBasePorKg');
    expect(calcularAnalise('EFICIENCIA', base, periodo).resultado).toHaveProperty('indiceDeEficiencia');
    expect(calcularAnalise('VIDA_UTIL', base, periodo).resultado).toHaveProperty('anoReferencia', 2026);
  });

  it('gera um CSV por tipo de análise (com BOM e separador ;)', () => {
    const efi = resultadoParaCsv('EFICIENCIA', calcularEficiencia(base, periodo));
    expect(efi.startsWith('\uFEFFIndicador;Valor')).toBe(true);
    expect(efi).toContain('Índice de eficiência');
    expect(efi).toContain('Operador;Movimentações');

    const ren = resultadoParaCsv('RENTABILIDADE', calcularRentabilidade(base));
    expect(ren).toContain('Tipo;Quantidade;Peso (kg)');
    expect(ren).toContain('TOTAL');
    expect(ren).toContain('Modelo;Quantidade');

    const vida = resultadoParaCsv('VIDA_UTIL', calcularVidaUtil(base, 2026));
    expect(vida).toContain('Idade limite (anos)');
    expect(vida).toContain('NOTEBOOK');
  });
});

// este trecho tem o dedo do Rossi.
