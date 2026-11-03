import { paraCsv } from '../utils/csv';
import type { Celula } from '../utils/csv';
import type { TipoAnalise } from '../dominio/enums';

// Converte o resultado de uma análise (JSON salvo no banco) em CSV para o Excel. Cada tipo vira uma tabela simples.
type Linhas = Celula[][];

const txt = (v: unknown): Celula => (v === null || v === undefined ? '' : typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v : JSON.stringify(v));

export function resultadoParaCsv(tipo: TipoAnalise, r: any): string {
  let linhas: Linhas;
  if (tipo === 'EFICIENCIA') {
    linhas = [
      ['Indicador', 'Valor'],
      ['Lotes', r.totais.lotes],
      ['Equipamentos', r.totais.equipamentos],
      ['Peso total (kg)', r.totais.pesoKg],
      ['Concluídos', r.totais.concluidos],
      ['Vazão (equip./dia)', r.vazaoEquipamentosPorDia],
      ['Taxa de conclusão (%)', txt(r.taxas.taxaConclusao)],
      ['Aproveitamento (%)', txt(r.taxas.aproveitamento)],
      ['Índice de eficiência', txt(r.indiceDeEficiencia)],
      ['Tempo médio até 1ª movimentação (h)', txt(r.tempoAtePrimeiraMovimentacaoHoras.media)],
      ['Tempo médio de ciclo (h)', txt(r.tempoDeCicloHoras.media)],
      ['Gargalo', r.gargalo ? `${r.gargalo.status} (${r.gargalo.quantidade})` : ''],
      [],
      ['Tipo', 'Equipamentos', 'Concluídos', 'Taxa de conclusão (%)', 'Aproveitamento (%)'],
      ...r.porTipo.map((t: any) => [t.tipo, t.equipamentos, t.concluidos, txt(t.taxaConclusao), txt(t.aproveitamento)]),
      [],
      ['Organização', 'Equipamentos', 'Concluídos', 'Taxa de conclusão (%)', 'Aproveitamento (%)'],
      ...r.porOrganizacao.map((o: any) => [o.organizacao, o.equipamentos, o.concluidos, txt(o.taxaConclusao), txt(o.aproveitamento)]),
      [],
      ['Etapa (destino)', 'Ocorrências', 'Tempo médio (h)'],
      ...r.porEtapa.map((e: any) => [e.etapa, e.ocorrencias, txt(e.tempoMedioHoras)]),
      [],
      ['Operador', 'Movimentações', 'Equipamentos', 'Tempo médio por etapa (h)'],
      ...r.porOperador.map((o: any) => [o.operador, o.movimentacoes, o.equipamentos, txt(o.tempoMedioPorEtapaHoras)]),
      [],
      ['Mês de entrada', 'Lotes', 'Equipamentos', 'Triagem média do lote (h)'],
      ...r.porPeriodo.map((p: any) => [p.periodo, p.lotes, p.equipamentos, txt(p.triagemMediaHoras)])
    ];
  } else if (tipo === 'RENTABILIDADE') {
    linhas = [
      ['Tipo', 'Quantidade', 'Peso (kg)', 'Receita estimada (R$)', 'Custo estimado (R$)', 'Margem (R$)', 'Margem (%)', 'Margem por equipamento (R$)'],
      ...r.porTipo.map((t: any) => [t.tipo, t.quantidade, t.pesoKg, t.receitaEstimada, t.custoEstimado, t.margem, txt(t.margemPercentual), t.margemPorEquipamento]),
      ['TOTAL', r.totais.equipamentos, '', r.totais.receitaEstimada, r.totais.custoEstimado, r.totais.margem, txt(r.totais.margemPercentual), ''],
      [],
      ['Marca', 'Quantidade', 'Receita estimada (R$)', 'Custo estimado (R$)', 'Margem (R$)', 'Margem por equipamento (R$)'],
      ...r.porMarca.map((m: any) => [m.marca, m.quantidade, m.receitaEstimada, m.custoEstimado, m.margem, m.margemPorEquipamento]),
      [],
      ['Modelo', 'Quantidade', 'Receita estimada (R$)', 'Custo estimado (R$)', 'Margem (R$)', 'Margem por equipamento (R$)'],
      ...r.porModelo.map((m: any) => [m.modelo, m.quantidade, m.receitaEstimada, m.custoEstimado, m.margem, m.margemPorEquipamento])
    ];
  } else {
    linhas = [
      ['Tipo', 'Quantidade', 'Inclinação', 'Intercepto', 'R²', 'Confiança', 'Idade limite (anos)', 'Vida restante média (anos)', 'Observação'],
      ...r.porTipo.map((t: any) => [t.tipo, t.quantidade, txt(t.regressao?.inclinacao), txt(t.regressao?.intercepto), txt(t.regressao?.r2), txt(t.confianca), txt(t.idadeLimiteAnos), txt(t.vidaRestanteMediaAnos), txt(t.observacao)])
    ];
  }
  return paraCsv(linhas);
}

// escrito com carinho por Arthur.
