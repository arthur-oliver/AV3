import { ajustarRegressao, arredondar, xParaAtingir } from './calculos';
import { MIN_PONTOS_REGRESSAO, SEVERIDADE, SEVERIDADE_INSERVIVEL } from './parametros';
import type { EquipamentoAnalise } from './tipos';

// Vida útil restante por regressão linear (mínimos quadrados) para cada tipo de equipamento:
//   x = idade em anos (ano de referência - ano de fabricação)
//   y = severidade do desgaste (0 = NOVO ... 6 = INSERVIVEL)
//   reta: y = inclinacao * x + intercepto
// A "idade limite" é o x em que a reta chega a INSERVIVEL. Vida restante = idade limite - idade atual (mínimo 0).
// A confiança vem do R²: >= 0,7 ALTA, >= 0,4 MEDIA, abaixo disso BAIXA.
const LIMITE_PREVISOES = 20;

const confianca = (r2: number) => (r2 >= 0.7 ? 'ALTA' : r2 >= 0.4 ? 'MEDIA' : 'BAIXA');

export function calcularVidaUtil(eqs: EquipamentoAnalise[], anoReferencia: number) {
  const mapa = new Map<string, EquipamentoAnalise[]>();
  for (const e of eqs) mapa.set(e.tipo, [...(mapa.get(e.tipo) ?? []), e]);

  const porTipo = [...mapa].map(([tipo, lista]) => {
    const idade = (e: EquipamentoAnalise) => Math.max(0, anoReferencia - e.anoFabricacao);
    const reg = ajustarRegressao(lista.map((e) => [idade(e), SEVERIDADE[e.estadoFisico]] as [number, number]), MIN_PONTOS_REGRESSAO);
    if (!reg) {
      return { tipo, quantidade: lista.length, regressao: null, confianca: null, idadeLimiteAnos: null, vidaRestanteMediaAnos: null, observacao: `Dados insuficientes: são necessários ao menos ${MIN_PONTOS_REGRESSAO} equipamentos com idades diferentes.`, previsoes: [] };
    }
    const limite = xParaAtingir(reg, SEVERIDADE_INSERVIVEL);
    if (limite === null) {
      return { tipo, quantidade: lista.length, regressao: reg, confianca: confianca(reg.r2), idadeLimiteAnos: null, vidaRestanteMediaAnos: null, observacao: 'Os dados não mostram desgaste crescente com a idade; não é possível projetar.', previsoes: [] };
    }
    const previsoes = lista
      .map((e) => ({
        equipamentoId: e.id,
        idadeAnos: idade(e),
        severidadeAtual: SEVERIDADE[e.estadoFisico],
        severidadeEsperada: arredondar(reg.inclinacao * idade(e) + reg.intercepto, 2),
        vidaRestanteAnos: arredondar(Math.max(0, limite - idade(e)), 1)
      }))
      .sort((a, b) => a.vidaRestanteAnos - b.vidaRestanteAnos);
    const media = previsoes.reduce((s, p) => s + p.vidaRestanteAnos, 0) / previsoes.length;
    return {
      tipo,
      quantidade: lista.length,
      regressao: reg,
      confianca: confianca(reg.r2),
      idadeLimiteAnos: arredondar(limite, 1),
      vidaRestanteMediaAnos: arredondar(media, 1),
      observacao: null as string | null,
      previsoes: previsoes.slice(0, LIMITE_PREVISOES)
    };
  }).sort((a, b) => b.quantidade - a.quantidade);

  return { anoReferencia, modelo: 'regressão linear simples (OLS): severidade = inclinacao x idade + intercepto', porTipo };
}

export type ResultadoVidaUtil = ReturnType<typeof calcularVidaUtil>;

// Arthur Oliver Rossi Alves, autor do Greencode.
