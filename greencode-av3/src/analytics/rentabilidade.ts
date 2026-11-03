import { arredondar } from './calculos';
import { CUSTO_DESCARTE_SEGURO_POR_KG, CUSTO_FIXO_POR_EQUIPAMENTO, CUSTO_PROCESSAMENTO_POR_KG, valorEstimadoDeRecuperacao } from './parametros';
import { destinoFinal } from './tipos';
import type { EquipamentoAnalise } from './tipos';

// Rentabilidade por tipo de equipamento:
//   receita estimada = valor de recuperação (peso x valor/kg x estado x marca)
//   custo            = peso x custo/kg + custo fixo por unidade (+ custo extra por kg se o destino é descarte seguro)
//   margem           = receita - custo
// Além do tipo, devolve marcas e modelos (os 10 de maior margem média por equipamento), para o cliente priorizar o que rende mais.
// Todos os valores usados estão em parametros.ts e são devolvidos junto do resultado.
type Acumulado = { quantidade: number; pesoKg: number; receita: number; custo: number };

function linha(chave: string, a: Acumulado) {
  const margem = a.receita - a.custo;
  return {
    chave,
    quantidade: a.quantidade,
    pesoKg: arredondar(a.pesoKg, 3),
    receitaEstimada: arredondar(a.receita),
    custoEstimado: arredondar(a.custo),
    margem: arredondar(margem),
    margemPercentual: a.receita > 0 ? arredondar((margem / a.receita) * 100, 1) : null,
    margemPorEquipamento: arredondar(margem / a.quantidade),
    receitaPorKg: a.pesoKg > 0 ? arredondar(a.receita / a.pesoKg) : null
  };
}

const LIMITE_RANKING = 10;

export function calcularRentabilidade(eqs: EquipamentoAnalise[]) {
  const grupos = { tipo: new Map<string, Acumulado>(), marca: new Map<string, Acumulado>(), modelo: new Map<string, Acumulado>() };
  const somar = (mapa: Map<string, Acumulado>, chave: string, peso: number, receita: number, custo: number) => {
    const a = mapa.get(chave) ?? { quantidade: 0, pesoKg: 0, receita: 0, custo: 0 };
    a.quantidade += 1;
    a.pesoKg += peso;
    a.receita += receita;
    a.custo += custo;
    mapa.set(chave, a);
  };

  for (const e of eqs) {
    const receita = valorEstimadoDeRecuperacao({ tipo: e.tipo, estadoFisico: e.estadoFisico, marca: e.marca, pesoQuilogramas: e.pesoKg });
    const custo = e.pesoKg * CUSTO_PROCESSAMENTO_POR_KG + CUSTO_FIXO_POR_EQUIPAMENTO + (destinoFinal(e) === 'DESCARTE_SEGURO' ? e.pesoKg * CUSTO_DESCARTE_SEGURO_POR_KG : 0);
    somar(grupos.tipo, e.tipo, e.pesoKg, receita, custo);
    somar(grupos.marca, e.marca.trim() || 'SEM MARCA', e.pesoKg, receita, custo);
    somar(grupos.modelo, `${e.marca.trim() || 'SEM MARCA'} ${e.modelo.trim() || 'SEM MODELO'}`, e.pesoKg, receita, custo);
  }

  const ranking = (mapa: Map<string, Acumulado>) => [...mapa].map(([k, a]) => linha(k, a)).sort((x, y) => y.margemPorEquipamento - x.margemPorEquipamento);
  const porTipo = [...grupos.tipo].map(([k, a]) => { const { chave, ...resto } = linha(k, a); return { tipo: chave, ...resto }; }).sort((x, y) => y.margem - x.margem);

  const receita = porTipo.reduce((s, t) => s + t.receitaEstimada, 0);
  const custo = porTipo.reduce((s, t) => s + t.custoEstimado, 0);
  return {
    totais: { equipamentos: eqs.length, receitaEstimada: arredondar(receita), custoEstimado: arredondar(custo), margem: arredondar(receita - custo), margemPercentual: receita > 0 ? arredondar(((receita - custo) / receita) * 100, 1) : null },
    maisRentavel: porTipo[0]?.tipo ?? null,
    menosRentavel: porTipo.length ? porTipo[porTipo.length - 1].tipo : null,
    porTipo,
    // Para priorizar o que dá mais retorno: marcas e modelos ordenados pela margem média por equipamento.
    porMarca: ranking(grupos.marca).slice(0, LIMITE_RANKING).map(({ chave, ...r }) => ({ marca: chave, ...r })),
    porModelo: ranking(grupos.modelo).slice(0, LIMITE_RANKING).map(({ chave, ...r }) => ({ modelo: chave, ...r }))
  };
}

export type ResultadoRentabilidade = ReturnType<typeof calcularRentabilidade>;

// este trecho tem o dedo do Rossi.
