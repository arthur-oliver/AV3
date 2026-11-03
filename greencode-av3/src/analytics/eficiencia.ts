import { StatusRastreamento } from '../dominio/enums';
import { arredondar, resumir } from './calculos';
import { destinoFinal, movimentoFinal } from './tipos';
import type { DestinoFinal, EquipamentoAnalise, PeriodoAnalise } from './tipos';

const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;

const percentual = (parte: number, total: number): number | null => (total === 0 ? null : arredondar((parte / total) * 100, 1));
const horasEntre = (de: Date, ate: Date) => Math.max(0, (ate.getTime() - de.getTime()) / HORA_MS);

// Eficiência operacional: o quanto do que entra é processado, em quanto tempo, com que aproveitamento e onde trava.
//  - concluído: o equipamento já chegou a um destino final (peças reaproveitadas, material reciclável ou descarte seguro);
//  - taxaConclusao: concluídos / total;
//  - aproveitamento: dos concluídos, quantos viraram peças reaproveitadas ou material reciclável;
//  - indice (0 a 100): média simples entre taxaConclusao e aproveitamento (null se não há dados);
//  - tempos em horas: da entrada do lote até a 1ª movimentação e até o destino final (só concluídos);
//  - gargalo: o status ainda em aberto com mais equipamentos parados, e a etapa que mais demora em média;
//  - triagem por lote: horas da entrada do lote até o fim da triagem (todos os equipamentos já saíram de EM_TRIAGEM);
//  - por operador: quantas movimentações cada responsável registrou e quanto tempo levou cada etapa sob sua responsabilidade;
//  - por período: o mesmo por mês de entrada do lote, para enxergar variação ao longo do ano.
const SAIDAS_DA_TRIAGEM = ['AGUARDANDO_DESMONTE', 'MATERIAL_RECICLAVEL', 'DESCARTE_SEGURO'];

const fimDaTriagem = (e: EquipamentoAnalise): Date | null => e.movimentos.find((m) => SAIDAS_DA_TRIAGEM.includes(m.destino))?.em ?? null;

// Horas da entrada até o fim da triagem de cada lote cuja triagem já terminou (todos os equipamentos saíram dela).
function triagemDosLotes(eqs: EquipamentoAnalise[]): Map<string, { entrada: Date; horas: number | null }> {
  const lotes = new Map<string, EquipamentoAnalise[]>();
  for (const e of eqs) lotes.set(e.loteId, [...(lotes.get(e.loteId) ?? []), e]);
  const r = new Map<string, { entrada: Date; horas: number | null }>();
  for (const [id, lista] of lotes) {
    const fins = lista.map(fimDaTriagem);
    const completa = fins.every((f) => f !== null);
    const ultimo = completa ? Math.max(...fins.map((f) => (f as Date).getTime())) : null;
    r.set(id, { entrada: lista[0].entradaEm, horas: ultimo === null ? null : Math.max(0, (ultimo - lista[0].entradaEm.getTime()) / HORA_MS) });
  }
  return r;
}

export function calcularEficiencia(eqs: EquipamentoAnalise[], periodo: PeriodoAnalise) {
  const destinos = new Map<string, DestinoFinal | null>(eqs.map((e) => [e.id, destinoFinal(e)]));
  const concluidos = eqs.filter((e) => destinos.get(e.id));
  const contarDestino = (lista: EquipamentoAnalise[], ...d: DestinoFinal[]) => lista.filter((e) => d.includes(destinos.get(e.id) as DestinoFinal)).length;

  const dias = Math.max(1, (periodo.fim.getTime() - periodo.inicio.getTime()) / DIA_MS);
  const porStatus = Object.fromEntries(Object.values(StatusRastreamento).map((s) => [s, eqs.filter((e) => e.status === s).length])) as Record<StatusRastreamento, number>;

  const reaproveitados = contarDestino(concluidos, 'PECAS_REAPROVEITADAS');
  const reciclados = contarDestino(concluidos, 'MATERIAL_RECICLAVEL');
  const descartados = contarDestino(concluidos, 'DESCARTE_SEGURO');

  const taxaConclusao = percentual(concluidos.length, eqs.length);
  const aproveitamento = percentual(reaproveitados + reciclados, concluidos.length);
  const indice = taxaConclusao === null ? null : arredondar((taxaConclusao + (aproveitamento ?? 0)) / 2, 1);

  const ateAPrimeira = eqs.filter((e) => e.movimentos.length > 0).map((e) => horasEntre(e.entradaEm, e.movimentos[0].em));
  const ciclo = concluidos.map((e) => horasEntre(e.entradaEm, movimentoFinal(e)?.em ?? e.movimentos[e.movimentos.length - 1]?.em ?? e.entradaEm));

  // Gargalo: entre os equipamentos ainda em processamento, o status com mais itens.
  const emAberto = eqs.filter((e) => !destinos.get(e.id) && e.status !== 'BAIXA_DEFINITIVA');
  const contagemAberta = new Map<string, number>();
  for (const e of emAberto) contagemAberta.set(e.status, (contagemAberta.get(e.status) ?? 0) + 1);
  const topo = [...contagemAberta].sort((a, b) => b[1] - a[1])[0];
  const gargalo = topo ? { status: topo[0], quantidade: topo[1], percentualDoTotal: percentual(topo[1], eqs.length) } : null;

  // Tempo de cada etapa = intervalo desde a movimentação anterior (ou desde a entrada do lote). A etapa é
  // atribuída a quem registrou a movimentação que a encerrou. O recebimento (AGUARDANDO_TRIAGEM) não conta.
  const porOperador = new Map<string, { movs: number; equips: Set<string>; duracoes: number[] }>();
  const porEtapa = new Map<string, number[]>();
  for (const e of eqs) {
    let anterior = e.entradaEm;
    for (const m of e.movimentos) {
      if (m.destino !== 'AGUARDANDO_TRIAGEM') {
        const h = horasEntre(anterior, m.em);
        const o = porOperador.get(m.responsavel) ?? { movs: 0, equips: new Set<string>(), duracoes: [] };
        o.movs += 1;
        o.equips.add(e.id);
        o.duracoes.push(h);
        porOperador.set(m.responsavel, o);
        porEtapa.set(m.destino, [...(porEtapa.get(m.destino) ?? []), h]);
      }
      anterior = m.em;
    }
  }
  const etapas = [...porEtapa].map(([etapa, d]) => ({ etapa, ocorrencias: d.length, tempoMedioHoras: resumir(d).media })).sort((a, b) => (b.tempoMedioHoras ?? 0) - (a.tempoMedioHoras ?? 0));

  const triagens = triagemDosLotes(eqs);
  const horasTriagem = [...triagens.values()].filter((t) => t.horas !== null).map((t) => t.horas as number);
  const mesesDosLotes = new Map<string, { lotes: number; horas: number[] }>();
  for (const t of triagens.values()) {
    const mes = t.entrada.toISOString().slice(0, 7);
    const m = mesesDosLotes.get(mes) ?? { lotes: 0, horas: [] };
    m.lotes += 1;
    if (t.horas !== null) m.horas.push(t.horas);
    mesesDosLotes.set(mes, m);
  }

  const agrupar = <K extends string>(chave: (e: EquipamentoAnalise) => K) => {
    const mapa = new Map<K, EquipamentoAnalise[]>();
    for (const e of eqs) mapa.set(chave(e), [...(mapa.get(chave(e)) ?? []), e]);
    return mapa;
  };
  const linha = (lista: EquipamentoAnalise[]) => {
    const c = lista.filter((e) => destinos.get(e.id));
    return {
      equipamentos: lista.length,
      concluidos: c.length,
      taxaConclusao: percentual(c.length, lista.length),
      aproveitamento: percentual(contarDestino(c, 'PECAS_REAPROVEITADAS', 'MATERIAL_RECICLAVEL'), c.length)
    };
  };

  return {
    totais: {
      lotes: new Set(eqs.map((e) => e.loteId)).size,
      equipamentos: eqs.length,
      pesoKg: arredondar(eqs.reduce((s, e) => s + e.pesoKg, 0), 3),
      concluidos: concluidos.length
    },
    vazaoEquipamentosPorDia: arredondar(eqs.length / dias, 2),
    distribuicaoPorStatus: porStatus,
    taxas: {
      taxaConclusao,
      aproveitamento,
      reaproveitadosPct: percentual(reaproveitados, concluidos.length),
      recicladosPct: percentual(reciclados, concluidos.length),
      descartePct: percentual(descartados, concluidos.length)
    },
    indiceDeEficiencia: indice,
    tempoAtePrimeiraMovimentacaoHoras: resumir(ateAPrimeira),
    tempoDeCicloHoras: resumir(ciclo),
    gargalo,
    etapaMaisLenta: etapas[0] ?? null,
    porEtapa: etapas,
    triagemDosLotes: { lotesAvaliados: triagens.size, lotesComTriagemConcluida: horasTriagem.length, horas: resumir(horasTriagem) },
    porOperador: [...porOperador]
      .map(([operador, o]) => ({ operador, movimentacoes: o.movs, equipamentos: o.equips.size, tempoMedioPorEtapaHoras: resumir(o.duracoes).media }))
      .sort((a, b) => b.movimentacoes - a.movimentacoes),
    porPeriodo: [...mesesDosLotes]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([periodo, m]) => ({
        periodo,
        lotes: m.lotes,
        equipamentos: eqs.filter((e) => e.entradaEm.toISOString().slice(0, 7) === periodo).length,
        triagemMediaHoras: resumir(m.horas).media
      })),
    porTipo: [...agrupar((e) => e.tipo)].map(([tipo, l]) => ({ tipo, ...linha(l) })).sort((a, b) => b.equipamentos - a.equipamentos),
    porOrganizacao: [...agrupar((e) => e.organizacaoId)]
      .map(([organizacaoId, l]) => ({ organizacaoId, organizacao: l[0].organizacaoNome, ...linha(l) }))
      .sort((a, b) => (b.aproveitamento ?? -1) - (a.aproveitamento ?? -1))
  };
}

export type ResultadoEficiencia = ReturnType<typeof calcularEficiencia>;

// Oliver passou por aqui.
