import { useEffect, useState } from 'react';
import { I, P, avisar, chamar, seguro } from '../lib/api.js';
import { useCarregar } from '../lib/hooks.js';
import { ANALISES, TIPOS, STATUS, rotulo, num, reais, pct, data, qs } from '../lib/rotulos.js';
import { Acoes, Barra, Botao, Cabeca, Campo, Carregando, H2, H3, Indicadores, LinhaCampos, Painel, Selo, Seletor, Entrada, Suave, Tabela, Vazio } from '../components/ui.jsx';

// ---------- visualização de cada análise ----------
function Eficiencia({ r }) {
  const maxEtapa = Math.max(1, ...r.porEtapa.map((e) => e.tempoMedioHoras || 0));
  return (
    <div>
      <Indicadores itens={[
        ['Índice de eficiência', num(r.indiceDeEficiencia, 1)], ['Equipamentos concluídos', pct(r.taxas.taxaConclusao)], ['Aproveitamento', pct(r.taxas.aproveitamento)],
        ['Triagem do lote (média)', r.triagemDosLotes.horas.media === null ? '-' : `${num(r.triagemDosLotes.horas.media, 1)} h`],
        ['Ciclo completo (média)', r.tempoDeCicloHoras.media === null ? '-' : `${num(r.tempoDeCicloHoras.media, 1)} h`],
        ['Equipamentos', num(r.totais.equipamentos, 0)], ['Lotes', num(r.totais.lotes, 0)], ['Vazão por dia', num(r.vazaoEquipamentosPorDia)]]} />
      {r.gargalo && <p>Gargalo atual: {rotulo(STATUS, r.gargalo.status)}, com {r.gargalo.quantidade} equipamento(s) parado(s) ({pct(r.gargalo.percentualDoTotal)} do total).</p>}
      {r.etapaMaisLenta && <p>Etapa mais demorada: {rotulo(STATUS, r.etapaMaisLenta.etapa)}, em média {num(r.etapaMaisLenta.tempoMedioHoras, 1)} h.</p>}
      <Suave>Lotes com triagem concluída: {r.triagemDosLotes.lotesComTriagemConcluida} de {r.triagemDosLotes.lotesAvaliados}.</Suave>
      <H3>Tempo médio por etapa (horas)</H3>
      <Tabela vazio="Ainda não há movimentações no período." linhas={r.porEtapa} colunas={[
        { titulo: 'Etapa', ver: (e) => rotulo(STATUS, e.etapa) }, { titulo: 'Ocorrências', num: true, ver: (e) => e.ocorrencias },
        { titulo: 'Tempo médio', ver: (e) => <Barra valor={e.tempoMedioHoras || 0} maximo={maxEtapa} /> }]} />
      <H3>Operadores</H3>
      <Tabela linhas={r.porOperador} colunas={[
        { titulo: 'Operador', ver: (o) => o.operador }, { titulo: 'Movimentações', num: true, ver: (o) => o.movimentacoes }, { titulo: 'Equipamentos', num: true, ver: (o) => o.equipamentos },
        { titulo: 'Tempo médio por etapa (h)', num: true, ver: (o) => num(o.tempoMedioPorEtapaHoras, 1) }]} />
      <H3>Variação por mês de entrada</H3>
      <Tabela linhas={r.porPeriodo} colunas={[
        { titulo: 'Mês', ver: (p) => p.periodo }, { titulo: 'Lotes', num: true, ver: (p) => p.lotes }, { titulo: 'Equipamentos', num: true, ver: (p) => p.equipamentos },
        { titulo: 'Triagem média do lote (h)', num: true, ver: (p) => num(p.triagemMediaHoras, 1) }]} />
      <H3>Por tipo de equipamento</H3>
      <Tabela linhas={r.porTipo} colunas={[
        { titulo: 'Tipo', ver: (t) => rotulo(TIPOS, t.tipo) }, { titulo: 'Equipamentos', num: true, ver: (t) => t.equipamentos }, { titulo: 'Concluídos', num: true, ver: (t) => t.concluidos },
        { titulo: 'Conclusão', num: true, ver: (t) => pct(t.taxaConclusao) }, { titulo: 'Aproveitamento', num: true, ver: (t) => pct(t.aproveitamento) }]} />
      {r.porOrganizacao.length > 1 && (
        <>
          <H3>Por organização</H3>
          <Tabela linhas={r.porOrganizacao} colunas={[
            { titulo: 'Organização', ver: (o) => o.organizacao }, { titulo: 'Equipamentos', num: true, ver: (o) => o.equipamentos },
            { titulo: 'Conclusão', num: true, ver: (o) => pct(o.taxaConclusao) }, { titulo: 'Aproveitamento', num: true, ver: (o) => pct(o.aproveitamento) }]} />
        </>
      )}
    </div>
  );
}

function Rentabilidade({ r }) {
  const maxTipo = Math.max(1, ...r.porTipo.map((t) => Math.abs(t.margem)));
  const ranking = (lista, campo) => (
    <Tabela linhas={lista} colunas={[
      { titulo: campo === 'marca' ? 'Marca' : 'Modelo', ver: (m) => m[campo] }, { titulo: 'Quantidade', num: true, ver: (m) => m.quantidade },
      { titulo: 'Receita estimada', num: true, ver: (m) => reais(m.receitaEstimada) }, { titulo: 'Margem por equipamento', num: true, ver: (m) => reais(m.margemPorEquipamento) }]} />
  );
  return (
    <div>
      <Indicadores itens={[
        ['Receita estimada', reais(r.totais.receitaEstimada)], ['Custo estimado', reais(r.totais.custoEstimado)], ['Margem', reais(r.totais.margem)], ['Margem (%)', pct(r.totais.margemPercentual)],
        ['Mais rentável', r.maisRentavel ? rotulo(TIPOS, r.maisRentavel) : '-'], ['Menos rentável', r.menosRentavel ? rotulo(TIPOS, r.menosRentavel) : '-']]} />
      <H3>Por tipo de equipamento</H3>
      <Tabela linhas={r.porTipo} colunas={[
        { titulo: 'Tipo', ver: (t) => rotulo(TIPOS, t.tipo) }, { titulo: 'Quantidade', num: true, ver: (t) => t.quantidade }, { titulo: 'Peso (kg)', num: true, ver: (t) => num(t.pesoKg) },
        { titulo: 'Receita', num: true, ver: (t) => reais(t.receitaEstimada) }, { titulo: 'Custo', num: true, ver: (t) => reais(t.custoEstimado) },
        { titulo: 'Margem', ver: (t) => <Barra valor={t.margem} maximo={maxTipo} negativo={t.margem < 0} /> }, { titulo: 'Margem (%)', num: true, ver: (t) => pct(t.margemPercentual) }]} />
      <H3>Marcas que mais rendem</H3>
      {ranking(r.porMarca, 'marca')}
      <H3>Modelos que mais rendem</H3>
      {ranking(r.porModelo, 'modelo')}
    </div>
  );
}

const CONFIANCA = { ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' };
function VidaUtil({ r }) {
  return (
    <div>
      <Suave>Modelo: {r.modelo}. Ano de referência: {r.anoReferencia}.</Suave>
      {r.porTipo.map((t) => (
        <Painel key={t.tipo} className="mt-3">
          <h3 className="mb-2 w-fit border-b-2 border-acao font-mono text-[0.9rem] font-semibold uppercase tracking-[0.1em]">{rotulo(TIPOS, t.tipo)} <Selo>{t.quantidade} equipamento(s)</Selo></h3>
          {t.regressao && (
            <Indicadores itens={[
              ['Desgaste por ano', num(t.regressao.inclinacao, 3)], ['Ajuste (R²)', num(t.regressao.r2, 2)], ['Confiança', t.confianca ? CONFIANCA[t.confianca] : '-'],
              ['Vida útil total', t.idadeLimiteAnos === null ? '-' : `${num(t.idadeLimiteAnos, 1)} anos`], ['Vida restante (média)', t.vidaRestanteMediaAnos === null ? '-' : `${num(t.vidaRestanteMediaAnos, 1)} anos`]]} />
          )}
          {t.observacao && <Suave>{t.observacao}</Suave>}
          {t.previsoes.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer">Equipamentos com menor vida restante ({t.previsoes.length})</summary>
              <Tabela linhas={t.previsoes} colunas={[
                { titulo: 'Equipamento', ver: (p) => p.equipamentoId.slice(0, 8) }, { titulo: 'Idade (anos)', num: true, ver: (p) => p.idadeAnos }, { titulo: 'Desgaste atual', num: true, ver: (p) => p.severidadeAtual },
                { titulo: 'Desgaste esperado', num: true, ver: (p) => num(p.severidadeEsperada) }, { titulo: 'Vida restante (anos)', num: true, ver: (p) => num(p.vidaRestanteAnos, 1) }]} />
            </details>
          )}
        </Painel>
      ))}
    </div>
  );
}

const VISUAIS = { EFICIENCIA: Eficiencia, RENTABILIDADE: Rentabilidade, VIDA_UTIL: VidaUtil };
const ORIGEM = { AGENDADA: 'agendada', TAREFA: 'relatório', MANUAL: 'manual' };
export function MostrarAnalise({ a }) {
  const Visual = VISUAIS[a.tipo];
  return (
    <div>
      <H2 className="mt-0">{rotulo(ANALISES, a.tipo)}</H2>
      <Suave>Calculada em {data(a.geradoEm)} ({ORIGEM[a.origem] || 'manual'}), período de {data(a.periodo.inicio)} a {data(a.periodo.fim)}.</Suave>
      <Visual r={a.resultado} />
    </div>
  );
}

// ---------- parceiro: sempre a análise mais recente da própria organização ----------
export function AnalisesParceiro() {
  const [tipo, setTipo] = useState('EFICIENCIA');
  const { dados, carregando } = useCarregar(() => chamar(P(`/analises/${tipo}`)), [tipo]);
  return (
    <div>
      <Cabeca titulo="Análises" texto="Indicadores calculados sobre os equipamentos da sua organização. Mostramos a análise mais recente." />
      <Campo rotulo="Análise" className="max-w-[300px]">{(id) => <Seletor id={id} opcoes={ANALISES} value={tipo} onChange={(e) => setTipo(e.target.value)} />}</Campo>
      <section className="mt-4">{carregando ? <Carregando /> : dados ? <MostrarAnalise a={dados} /> : <Vazio>Não foi possível carregar esta análise.</Vazio>}</section>
    </div>
  );
}

// ---------- equipe interna: calcular agora + histórico ----------
export function AnalisesInterno() {
  const [tipo, setTipo] = useState('EFICIENCIA');
  const [org, setOrg] = useState('');
  const [ini, setIni] = useState('');
  const [fim, setFim] = useState('');
  const [mostrada, setMostrada] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const orgs = useCarregar(() => chamar(I('/organizacoes?limite=200')), []);
  const hist = useCarregar(() => chamar(I(`/analises/historico?${qs({ limite: 10, tipo })}`)), [tipo]);

  async function calcular(ev) {
    ev.preventDefault();
    setCalculando(true);
    const corpo = {};
    if (org) corpo.organizacaoId = org;
    if (ini) corpo.inicio = ini;
    if (fim) corpo.fim = fim;
    // Calcula a escolhida e atualiza todas as outras; a tela mostra só a escolhida.
    const r = await seguro(() => chamar(I(`/analises/${tipo}/executar-todas`), { metodo: 'POST', corpo }));
    setCalculando(false);
    if (r) {
      setMostrada(r.dados.analise);
      hist.recarregar();
      const { executadas, falhas } = r.dados;
      avisar('Análises atualizadas', `${executadas} cálculo(s) concluído(s)${falhas.length ? `, ${falhas.length} falha(s)` : ''}.`, falhas.length ? 'erro' : 'ok');
    }
  }
  async function abrir(a) {
    const d = await seguro(() => chamar(I(`/analises/historico/${a.id}`)));
    if (d) setMostrada(d.dados);
  }
  const opcoesOrg = Object.fromEntries((orgs.dados || []).map((o) => [o.id, o.razaoSocial]));
  return (
    <div>
      <Cabeca titulo="Análises" texto="Calcular agora atualiza as três análises de todas as organizações e mostra abaixo a escolhida. Elas também rodam sozinhas todos os dias de madrugada." />
      <Painel>
        <form onSubmit={calcular}>
          <LinhaCampos>
            <Campo rotulo="Análise">{(id) => <Seletor id={id} opcoes={ANALISES} value={tipo} onChange={(e) => setTipo(e.target.value)} />}</Campo>
            <Campo rotulo="Organização">{(id) => <Seletor id={id} opcoes={opcoesOrg} vazio="Todas as organizações" value={org} onChange={(e) => setOrg(e.target.value)} />}</Campo>
            <Campo rotulo="De (opcional)">{(id) => <Entrada id={id} type="date" value={ini} onChange={(e) => setIni(e.target.value)} />}</Campo>
            <Campo rotulo="Até (opcional)">{(id) => <Entrada id={id} type="date" value={fim} onChange={(e) => setFim(e.target.value)} />}</Campo>
          </LinhaCampos>
          <Acoes><Botao type="submit" disabled={calculando}>{calculando ? 'Calculando...' : 'Calcular agora'}</Botao></Acoes>
        </form>
      </Painel>
      {mostrada && <section className="mt-4"><MostrarAnalise a={mostrada} /></section>}
      <H2>Histórico</H2>
      <Tabela vazio="Ainda não há análises deste tipo." linhas={hist.dados} aoClicar={abrir} colunas={[
        { titulo: 'Gerada em', ver: (a) => data(a.geradoEm) }, { titulo: 'Origem', ver: (a) => ({ AGENDADA: 'Agendada', MANUAL: 'Manual', TAREFA: 'Relatório' })[a.origem] },
        { titulo: 'Escopo', ver: (a) => (a.organizacaoId ? 'Uma organização' : 'Todas') }, { titulo: 'Duração', num: true, ver: (a) => `${a.duracaoMs} ms` }]} />
    </div>
  );
}

// Alves aprova este código.
