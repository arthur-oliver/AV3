'use strict';
/* Portal do Greencode: interface web (sem build) para parceiros (chave de API) e equipe interna (login).
   Todo texto vindo da API entra na página por textContent, nunca como HTML. */

// ---------- utilidades ----------
const h = (tag, attrs, ...filhos) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value') e.dataset.valor = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat(9)) {
    if (f === null || f === undefined || f === false) continue;
    e.append(f.nodeType ? f : document.createTextNode(String(f)));
  }
  if (e.dataset.valor !== undefined) { e.value = e.dataset.valor; delete e.dataset.valor; }
  return e;
};
const $ = (s, r = document) => r.querySelector(s);
// Como replaceChildren, mas ignora null/false (que viraria o texto "null").
const pintar = (alvo, ...filhos) => alvo.replaceChildren(...filhos.flat(9).filter((f) => f !== null && f !== undefined && f !== false));
const num = (n, c = 2) => (n === null || n === undefined ? '-' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: c }));
const reais = (n) => (n === null || n === undefined ? '-' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (n) => (n === null || n === undefined ? '-' : `${num(n, 1)}%`);
const data = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-');

const STATUS = { AGUARDANDO_TRIAGEM: 'Aguardando triagem', EM_TRIAGEM: 'Em triagem', AGUARDANDO_DESMONTE: 'Aguardando desmonte', EM_DESMONTE: 'Em desmonte', PECAS_REAPROVEITADAS: 'Peças reaproveitadas', MATERIAL_RECICLAVEL: 'Material reciclável', DESCARTE_SEGURO: 'Descarte seguro', BAIXA_DEFINITIVA: 'Baixa definitiva' };
const TIPOS = { COMPUTADOR_MESA: 'Computador de mesa', NOTEBOOK: 'Notebook', MONITOR: 'Monitor', IMPRESSORA: 'Impressora', SERVIDOR: 'Servidor', ROTEADOR: 'Roteador', CABO_ESTRUTURADO: 'Cabo estruturado', FONTE_ALIMENTACAO: 'Fonte de alimentação' };
const ESTADOS = { NOVO: 'Novo', BOM_ESTADO: 'Bom estado', USADO_LEVE: 'Usado (leve)', USADO_MODERADO: 'Usado (moderado)', DANIFICADO_LEVE: 'Danificado (leve)', DANIFICADO_GRAVE: 'Danificado (grave)', INSERVIVEL: 'Inservível' };
const ANALISES = { EFICIENCIA: 'Eficiência operacional', RENTABILIDADE: 'Rentabilidade por tipo', VIDA_UTIL: 'Vida útil restante' };
const LOTES = { RECEBIDO: 'Recebido', EM_TRIAGEM: 'Em triagem', TRIAGEM_CONCLUIDA: 'Triagem concluída', ENCAMINHADO: 'Encaminhado', FINALIZADO: 'Finalizado' };
const PERMISSOES = { LER_RASTREABILIDADE: 'Consultar lotes e rastrear equipamentos', ESCREVER_LOTES: 'Registrar lotes', LER_RELATORIOS: 'Ver análises e pedir relatórios' };
const STATUS_TAREFA = { PENDENTE: ['Na fila', 'andamento'], PROCESSANDO: ['Processando', 'andamento'], CONCLUIDA: ['Pronto', 'ok'], FALHA: ['Falhou', 'erro'] };
const rotulo = (m, k) => m[k] || k;
const opcoes = (m, vazio) => [vazio ? h('option', { value: '' }, vazio) : null, ...Object.entries(m).map(([k, v]) => h('option', { value: k }, v))];

// ---------- sessão ----------
let sessao = JSON.parse(sessionStorage.getItem('gc_sessao') || 'null');
const salvarSessao = () => (sessao ? sessionStorage.setItem('gc_sessao', JSON.stringify(sessao)) : sessionStorage.removeItem('gc_sessao'));
const P = (c) => '/api/v1/public' + c;
const I = (c) => '/api/v1/internal' + c;
const A = (c) => '/api/v1/admin' + c;
let limiteVisto = null;

function aviso(titulo, texto, tipo = 'ok') {
  const caixa = $('#avisos');
  const el = h('div', { class: `aviso ${tipo}`, role: tipo === 'erro' ? 'alert' : 'status' }, h('b', null, titulo), texto || null);
  caixa.append(el);
  setTimeout(() => el.remove(), tipo === 'erro' ? 9000 : 4500);
}

class ErroApi extends Error {
  constructor(r, corpo) { super((corpo && corpo.mensagem) || `Falha ${r.status}`); this.status = r.status; this.codigo = corpo && corpo.erro; }
}

async function chamar(caminho, { metodo = 'GET', corpo, bruto } = {}) {
  const cab = {};
  if (corpo) cab['Content-Type'] = 'application/json';
  if (sessao && sessao.modo === 'parceiro') cab['X-API-Key'] = sessao.chave;
  if (sessao && sessao.modo === 'interno') cab.Authorization = `Bearer ${sessao.token}`;
  const r = await fetch(caminho, { method: metodo, headers: cab, body: corpo ? JSON.stringify(corpo) : undefined });
  const lim = r.headers.get('X-RateLimit-Limit');
  if (lim) { limiteVisto = { limite: Number(lim), restante: Number(r.headers.get('X-RateLimit-Remaining')) }; atualizarLimite(); }
  if (!r.ok) {
    const j = await r.json().catch(() => null);
    if (r.status === 401 && sessao && sessao.modo === 'interno' && caminho !== I('/auth/login')) { sair(); }
    throw new ErroApi(r, j);
  }
  if (bruto) return r;
  const texto = await r.text();
  return { dados: texto ? JSON.parse(texto) : null, total: Number(r.headers.get('X-Total-Count') || 0) };
}

async function seguro(fn) {
  try { return await fn(); } catch (e) {
    let dica = '';
    if (e.codigo === 'LIMITE_DA_CHAVE') dica = ' Aguarde alguns segundos e tente de novo.';
    aviso('Não foi possível concluir', (e.message || 'Erro inesperado.') + dica, 'erro');
    return null;
  }
}

async function baixar(caminho, nomePadrao) {
  const r = await seguro(() => chamar(caminho, { bruto: true }));
  if (!r) return;
  const m = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '');
  const blob = await r.blob();
  const a = h('a', { href: URL.createObjectURL(blob), download: m ? m[1] : nomePadrao });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- componentes ----------
const tabela = (colunas, linhas, { aoClicar, vazio = 'Nada para mostrar.' } = {}) => {
  if (!linhas.length) return h('p', { class: 'vazio' }, vazio);
  return h('div', { class: 'rolagem' }, h('table', null,
    h('thead', null, h('tr', null, colunas.map((c) => h('th', { class: c.num ? 'num' : null }, c.titulo)))),
    h('tbody', null, linhas.map((l) => h('tr', { class: aoClicar ? 'clicavel' : null, tabindex: aoClicar ? '0' : null, onclick: aoClicar ? () => aoClicar(l) : null, onkeydown: aoClicar ? (ev) => { if (ev.key === 'Enter') aoClicar(l); } : null },
      colunas.map((c) => h('td', { class: c.num ? 'num' : null }, c.valor(l))))))));
};
const barra = (valor, maximo, negativo) => h('span', { class: 'celula-barra' }, h('span', { class: `barra${negativo ? ' neg' : ''}`, style: `width:${maximo ? Math.max(2, Math.min(100, (Math.abs(valor) / maximo) * 100)) : 2}px` }), num(valor));
const indicadores = (itens) => h('dl', { class: 'indicadores' }, itens.map(([t, v]) => h('div', null, h('dt', null, t), h('dd', null, v))));
const selo = (texto, tipo) => h('span', { class: `selo ${tipo || ''}` }, texto);
const cabeca = (titulo, texto) => h('div', { class: 'cabeca' }, h('h1', null, titulo), texto ? h('p', null, texto) : null);

const ETAPAS = [
  ['Recebido', ['AGUARDANDO_TRIAGEM']],
  ['Triagem', ['EM_TRIAGEM']],
  ['Desmonte', ['AGUARDANDO_DESMONTE', 'EM_DESMONTE']],
  ['Destino', ['PECAS_REAPROVEITADAS', 'MATERIAL_RECICLAVEL', 'DESCARTE_SEGURO']],
  ['Baixa', ['BAIXA_DEFINITIVA']]
];
// Trilha de rastreio: cada estação acende quando o equipamento já passou por ela.
function trilha(visitados, atual, extra) {
  return h('ol', { class: 'trilha', 'aria-label': 'Etapas do equipamento' }, ETAPAS.map(([nome, status], i) => {
    const feito = status.some((s) => visitados.has(s));
    const eAtual = status.includes(atual);
    const detalhe = status.find((s) => visitados.has(s));
    return h('li', { class: `${feito ? 'feito' : ''} ${eAtual ? 'atual' : ''}`, style: `--i:${i}` }, h('span', null, nome), extra && detalhe && nome === 'Destino' ? h('span', { class: 'suave' }, rotulo(STATUS, detalhe)) : null);
  }));
}

// ---------- visualização das análises ----------
function verEficiencia(r) {
  const maxEtapa = Math.max(1, ...r.porEtapa.map((e) => e.tempoMedioHoras || 0));
  return h('div', null,
    indicadores([
      ['Índice de eficiência', num(r.indiceDeEficiencia, 1)], ['Equipamentos concluídos', pct(r.taxas.taxaConclusao)], ['Aproveitamento', pct(r.taxas.aproveitamento)],
      ['Triagem do lote (média)', r.triagemDosLotes.horas.media === null ? '-' : `${num(r.triagemDosLotes.horas.media, 1)} h`], ['Ciclo completo (média)', r.tempoDeCicloHoras.media === null ? '-' : `${num(r.tempoDeCicloHoras.media, 1)} h`], ['Equipamentos', num(r.totais.equipamentos, 0)], ['Lotes', num(r.totais.lotes, 0)], ['Vazão por dia', num(r.vazaoEquipamentosPorDia)]
    ]),
    r.gargalo ? h('p', null, `Gargalo atual: ${rotulo(STATUS, r.gargalo.status)}, com ${r.gargalo.quantidade} equipamento(s) parado(s) (${pct(r.gargalo.percentualDoTotal)} do total).`) : null,
    r.etapaMaisLenta ? h('p', null, `Etapa mais demorada: ${rotulo(STATUS, r.etapaMaisLenta.etapa)}, em média ${num(r.etapaMaisLenta.tempoMedioHoras, 1)} h.`) : null,
    h('p', { class: 'suave' }, `Lotes com triagem concluída: ${r.triagemDosLotes.lotesComTriagemConcluida} de ${r.triagemDosLotes.lotesAvaliados}.`),
    h('h3', null, 'Tempo médio por etapa (horas)'),
    tabela([{ titulo: 'Etapa', valor: (e) => rotulo(STATUS, e.etapa) }, { titulo: 'Ocorrências', num: true, valor: (e) => e.ocorrencias }, { titulo: 'Tempo médio', valor: (e) => barra(e.tempoMedioHoras || 0, maxEtapa) }], r.porEtapa, { vazio: 'Ainda não há movimentações no período.' }),
    h('h3', null, 'Operadores'),
    tabela([{ titulo: 'Operador', valor: (o) => o.operador }, { titulo: 'Movimentações', num: true, valor: (o) => o.movimentacoes }, { titulo: 'Equipamentos', num: true, valor: (o) => o.equipamentos }, { titulo: 'Tempo médio por etapa (h)', num: true, valor: (o) => num(o.tempoMedioPorEtapaHoras, 1) }], r.porOperador),
    h('h3', null, 'Variação por mês de entrada'),
    tabela([{ titulo: 'Mês', valor: (p) => p.periodo }, { titulo: 'Lotes', num: true, valor: (p) => p.lotes }, { titulo: 'Equipamentos', num: true, valor: (p) => p.equipamentos }, { titulo: 'Triagem média do lote (h)', num: true, valor: (p) => num(p.triagemMediaHoras, 1) }], r.porPeriodo),
    h('h3', null, 'Por tipo de equipamento'),
    tabela([{ titulo: 'Tipo', valor: (t) => rotulo(TIPOS, t.tipo) }, { titulo: 'Equipamentos', num: true, valor: (t) => t.equipamentos }, { titulo: 'Concluídos', num: true, valor: (t) => t.concluidos }, { titulo: 'Conclusão', num: true, valor: (t) => pct(t.taxaConclusao) }, { titulo: 'Aproveitamento', num: true, valor: (t) => pct(t.aproveitamento) }], r.porTipo),
    r.porOrganizacao.length > 1 ? [h('h3', null, 'Por organização'), tabela([{ titulo: 'Organização', valor: (o) => o.organizacao }, { titulo: 'Equipamentos', num: true, valor: (o) => o.equipamentos }, { titulo: 'Conclusão', num: true, valor: (o) => pct(o.taxaConclusao) }, { titulo: 'Aproveitamento', num: true, valor: (o) => pct(o.aproveitamento) }], r.porOrganizacao)] : null);
}

function verRentabilidade(r) {
  const maxTipo = Math.max(1, ...r.porTipo.map((t) => Math.abs(t.margem)));
  const ranking = (lista, campo) => tabela([{ titulo: campo === 'marca' ? 'Marca' : 'Modelo', valor: (m) => m[campo] }, { titulo: 'Quantidade', num: true, valor: (m) => m.quantidade }, { titulo: 'Receita estimada', num: true, valor: (m) => reais(m.receitaEstimada) }, { titulo: 'Margem por equipamento', num: true, valor: (m) => reais(m.margemPorEquipamento) }], lista);
  return h('div', null,
    indicadores([['Receita estimada', reais(r.totais.receitaEstimada)], ['Custo estimado', reais(r.totais.custoEstimado)], ['Margem', reais(r.totais.margem)], ['Margem (%)', pct(r.totais.margemPercentual)], ['Mais rentável', r.maisRentavel ? rotulo(TIPOS, r.maisRentavel) : '-'], ['Menos rentável', r.menosRentavel ? rotulo(TIPOS, r.menosRentavel) : '-']]),
    h('h3', null, 'Por tipo de equipamento'),
    tabela([{ titulo: 'Tipo', valor: (t) => rotulo(TIPOS, t.tipo) }, { titulo: 'Quantidade', num: true, valor: (t) => t.quantidade }, { titulo: 'Peso (kg)', num: true, valor: (t) => num(t.pesoKg) }, { titulo: 'Receita', num: true, valor: (t) => reais(t.receitaEstimada) }, { titulo: 'Custo', num: true, valor: (t) => reais(t.custoEstimado) }, { titulo: 'Margem', valor: (t) => barra(t.margem, maxTipo, t.margem < 0) }, { titulo: 'Margem (%)', num: true, valor: (t) => pct(t.margemPercentual) }], r.porTipo),
    h('h3', null, 'Marcas que mais rendem'), ranking(r.porMarca, 'marca'),
    h('h3', null, 'Modelos que mais rendem'), ranking(r.porModelo, 'modelo'));
}

function verVidaUtil(r) {
  return h('div', null,
    h('p', { class: 'suave' }, `Modelo: ${r.modelo}. Ano de referência: ${r.anoReferencia}.`),
    r.porTipo.map((t) => h('div', { class: 'painel', style: 'margin-bottom:.8rem' },
      h('h3', null, rotulo(TIPOS, t.tipo), ' ', selo(`${t.quantidade} equipamento(s)`)),
      t.regressao
        ? indicadores([['Desgaste por ano', num(t.regressao.inclinacao, 3)], ['Ajuste (R²)', num(t.regressao.r2, 2)], ['Confiança', t.confianca ? ({ ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' })[t.confianca] : '-'], ['Vida útil total', t.idadeLimiteAnos === null ? '-' : `${num(t.idadeLimiteAnos, 1)} anos`], ['Vida restante (média)', t.vidaRestanteMediaAnos === null ? '-' : `${num(t.vidaRestanteMediaAnos, 1)} anos`]])
        : null,
      t.observacao ? h('p', { class: 'suave' }, t.observacao) : null,
      t.previsoes.length ? h('details', null, h('summary', null, `Equipamentos com menor vida restante (${t.previsoes.length})`),
        tabela([{ titulo: 'Equipamento', valor: (p) => p.equipamentoId.slice(0, 8) }, { titulo: 'Idade (anos)', num: true, valor: (p) => p.idadeAnos }, { titulo: 'Desgaste atual', num: true, valor: (p) => p.severidadeAtual }, { titulo: 'Desgaste esperado', num: true, valor: (p) => num(p.severidadeEsperada) }, { titulo: 'Vida restante (anos)', num: true, valor: (p) => num(p.vidaRestanteAnos, 1) }], t.previsoes)) : null)));
}

const VISUAIS = { EFICIENCIA: verEficiencia, RENTABILIDADE: verRentabilidade, VIDA_UTIL: verVidaUtil };
const mostrarAnalise = (a) => h('div', null,
  h('h2', null, rotulo(ANALISES, a.tipo)),
  h('p', { class: 'suave' }, `Calculada em ${data(a.geradoEm)} (${a.origem === 'AGENDADA' ? 'agendada' : a.origem === 'TAREFA' ? 'relatório' : 'manual'}), período de ${data(a.periodo.inicio)} a ${data(a.periodo.fim)}.`),
  VISUAIS[a.tipo](a.resultado));

// ---------- relatórios assíncronos (parceiro e interno) ----------
const chaveTarefas = () => `gc_tarefas_${sessao.modo}_${sessao.id || 'x'}`;
const lerTarefas = () => JSON.parse(localStorage.getItem(chaveTarefas()) || '[]');
const gravarTarefas = (l) => localStorage.setItem(chaveTarefas(), JSON.stringify(l.slice(0, 30)));
let temporizador = null;

function vRelatorios() {
  const interno = sessao.modo === 'interno';
  const base = interno ? I('/relatorios-assincronos') : P('/relatorios');
  const lista = h('div');
  const orgSel = interno ? h('select', { id: 'org' }, h('option', { value: '' }, 'Todas as organizações')) : null;
  if (interno) seguro(() => chamar(I('/organizacoes?limite=200'))).then((r) => r && r.dados.forEach((o) => orgSel.append(h('option', { value: o.id }, o.razaoSocial))));

  async function atualizar() {
    const tarefas = lerTarefas();
    let pendente = false;
    for (const t of tarefas) {
      if (t.status === 'CONCLUIDA' || t.status === 'FALHA') continue;
      try {
        const r = await chamar(`${base}/${t.id}`);
        Object.assign(t, r.dados);
      } catch (e) { if (e.status === 404) t.status = 'FALHA'; }
      if (t.status !== 'CONCLUIDA' && t.status !== 'FALHA') pendente = true;
    }
    gravarTarefas(tarefas);
    desenhar(tarefas);
    clearTimeout(temporizador);
    if (pendente) temporizador = setTimeout(atualizar, 2000);
  }
  function desenhar(tarefas) {
    pintar(lista, tabela(
      [{ titulo: 'Relatório', valor: (t) => `${rotulo(ANALISES, t.tipo)} (${t.formato})` }, { titulo: 'Pedido em', valor: (t) => data(t.criadoEm) },
       { titulo: 'Situação', valor: (t) => { const [txt, cls] = STATUS_TAREFA[t.status] || [t.status, '']; return h('span', null, selo(txt, cls), t.status === 'PENDENTE' && t.tentativas > 0 ? ` nova tentativa ${t.tentativas}/${t.maxTentativas}` : '', t.status === 'FALHA' && t.erro ? ` ${t.erro}` : ''); } },
       { titulo: '', valor: (t) => (t.status === 'CONCLUIDA' ? h('button', { class: 'mini', onclick: () => baixar(`${base}/${t.id}/download`, t.nomeArquivo || `relatorio.${t.formato.toLowerCase()}`) }, 'Baixar') : null) }],
      tarefas, { vazio: 'Você ainda não pediu nenhum relatório neste navegador.' }));
  }
  async function pedir(ev) {
    ev.preventDefault();
    const corpo = { tipo: $('#tipo').value, formato: $('#formato').value };
    if ($('#ini').value) corpo.inicio = $('#ini').value;
    if ($('#fim').value) corpo.fim = $('#fim').value;
    if (interno && $('#org').value) corpo.organizacaoId = $('#org').value;
    const r = await seguro(() => chamar(base, { metodo: 'POST', corpo }));
    if (!r) return;
    gravarTarefas([r.dados, ...lerTarefas()]);
    aviso('Relatório pedido', 'Ele será gerado em segundo plano. Esta lista atualiza sozinha.');
    atualizar();
  }
  setTimeout(atualizar, 0);
  return h('div', null,
    cabeca('Relatórios', 'Peça um relatório, acompanhe o andamento e baixe o arquivo quando estiver pronto. Pedidos grandes não travam a tela: rodam em segundo plano.'),
    h('form', { class: 'painel', onsubmit: pedir },
      h('div', { class: 'linha-campos' },
        h('div', { class: 'campo' }, h('label', { for: 'tipo' }, 'Relatório'), h('select', { id: 'tipo' }, opcoes(ANALISES))),
        h('div', { class: 'campo' }, h('label', { for: 'formato' }, 'Formato'), h('select', { id: 'formato' }, h('option', { value: 'CSV' }, 'CSV (abre no Excel)'), h('option', { value: 'JSON' }, 'JSON'))),
        h('div', { class: 'campo' }, h('label', { for: 'ini' }, 'De (opcional)'), h('input', { id: 'ini', type: 'date' })),
        h('div', { class: 'campo' }, h('label', { for: 'fim' }, 'Até (opcional)'), h('input', { id: 'fim', type: 'date' })),
        interno ? h('div', { class: 'campo' }, h('label', { for: 'org' }, 'Organização'), orgSel) : null),
      h('div', { class: 'acoes' }, h('button', { type: 'submit' }, 'Pedir relatório'))),
    h('section', { class: 'bloco' }, h('h2', null, 'Seus pedidos'), lista));
}

// ---------- telas do parceiro ----------
const tem = (p) => sessao.permissoes.includes(p);

function vInicioParceiro() {
  return h('div', null,
    cabeca('Seu painel', 'Acompanhe os equipamentos enviados, registre novos lotes e consulte as análises da sua organização.'),
    h('div', { class: 'painel' },
      h('h3', null, sessao.nome),
      h('p', { class: 'suave' }, `Organização ${sessao.organizacaoId}`),
      h('h3', null, 'O que esta chave permite'),
      h('ul', null, Object.entries(PERMISSOES).map(([k, v]) => h('li', { style: tem(k) ? '' : 'opacity:.5' }, `${v}${tem(k) ? '' : ' (não liberado)'}`)))),
    h('p', { class: 'suave', style: 'margin-top:1rem' }, 'Cada chave tem um limite de requisições por minuto, mostrado no menu lateral. Ao atingir o limite, aguarde alguns segundos.'));
}

function vLotes(id) {
  if (id) return vLoteDetalhe(id);
  let pagina = 1;
  const alvo = h('div');
  const status = h('select', { id: 'st' }, opcoes(LOTES, 'Todos os status'));
  async function carregar() {
    const q = new URLSearchParams({ pagina, limite: 15 });
    if (status.value) q.set('status', status.value);
    const r = await seguro(() => chamar(P(`/lotes?${q}`)));
    if (!r) return;
    const ultima = Math.max(1, Math.ceil(r.total / 15));
    pintar(alvo, 
      tabela([{ titulo: 'Nota fiscal', valor: (l) => l.notaFiscal }, { titulo: 'Entrada', valor: (l) => data(l.dataEntrada) }, { titulo: 'Transportadora', valor: (l) => l.transportadora }, { titulo: 'Equipamentos', num: true, valor: (l) => (l._count ? l._count.equipamentos : '-') }, { titulo: 'Situação', valor: (l) => selo(rotulo(LOTES, l.statusProcessamento)) }],
        r.dados, { aoClicar: (l) => (location.hash = `#/lotes/${l.id}`), vazio: 'Nenhum lote encontrado.' }),
      h('div', { class: 'paginacao' }, h('button', { class: 'sec mini', disabled: pagina <= 1, onclick: () => { pagina--; carregar(); } }, 'Anterior'), `Página ${pagina} de ${ultima} (${r.total} lotes)`, h('button', { class: 'sec mini', disabled: pagina >= ultima, onclick: () => { pagina++; carregar(); } }, 'Próxima')));
  }
  status.addEventListener('change', () => { pagina = 1; carregar(); });
  setTimeout(carregar, 0);
  return h('div', null, cabeca('Lotes', 'Abra um lote para ver os equipamentos e acompanhar cada um.'), h('div', { class: 'campo', style: 'max-width:260px' }, h('label', { for: 'st' }, 'Filtrar por situação'), status), alvo);
}

function vLoteDetalhe(id) {
  const alvo = h('div', null, h('p', { class: 'vazio' }, 'Carregando...'));
  seguro(() => chamar(P(`/lotes/${id}`))).then((r) => {
    if (!r) { pintar(alvo, h('p', null, h('a', { href: '#/lotes' }, 'Voltar para os lotes'))); return; }
    const l = r.dados;
    pintar(alvo, 
      indicadores([['Nota fiscal', l.notaFiscal], ['Entrada', data(l.dataEntrada)], ['Transportadora', l.transportadora], ['Situação', rotulo(LOTES, l.statusProcessamento)], ['Equipamentos', l.resumo.quantidade], ['Peso total', `${num(l.resumo.pesoTotalKg)} kg`]]),
      l.observacoes ? h('p', null, l.observacoes) : null,
      h('h2', null, 'Equipamentos'),
      tabela([{ titulo: '#', num: true, valor: (e) => e.posicaoNoLote }, { titulo: 'Tipo', valor: (e) => rotulo(TIPOS, e.tipo) }, { titulo: 'Marca e modelo', valor: (e) => `${e.marca} ${e.modelo}`.trim() || '-' }, { titulo: 'Ano', num: true, valor: (e) => e.anoFabricacao }, { titulo: 'Estado', valor: (e) => rotulo(ESTADOS, e.estadoFisico) }, { titulo: 'Situação', valor: (e) => selo(rotulo(STATUS, e.statusRastreamento)) }],
        l.equipamentos, { aoClicar: (e) => (location.hash = `#/rastrear/${e.id}`), vazio: 'Este lote ainda não tem equipamentos.' }));
  });
  return h('div', null, h('p', null, h('a', { href: '#/lotes' }, 'Voltar para os lotes')), cabeca('Detalhe do lote'), alvo);
}

function vRastrear(id) {
  const alvo = h('div');
  const campo = h('input', { id: 'codigo', placeholder: 'Código do equipamento (36 caracteres)', value: id || '' });
  async function buscar(codigo) {
    const r = await seguro(() => chamar(P(`/rastreabilidade/${encodeURIComponent(codigo.trim())}`)));
    if (!r) { pintar(alvo, h('p', { class: 'vazio' }, 'Confira o código. Ele fica na etiqueta do equipamento e no detalhe do lote.')); return; }
    const { equipamento: e, movimentacoes: m } = r.dados;
    const visitados = new Set(m.map((x) => x.destino));
    visitados.add(e.statusRastreamento);
    pintar(alvo, 
      h('h2', null, `${rotulo(TIPOS, e.tipo)} ${e.marca} ${e.modelo}`.trim()),
      h('p', { class: 'suave' }, `Código ${e.codigoBarrasInterno}. ${rotulo(ESTADOS, e.estadoFisico)}, ${num(e.pesoQuilogramas)} kg, fabricado em ${e.anoFabricacao}.`),
      trilha(visitados, e.statusRastreamento, true),
      h('p', null, `Situação atual: `, selo(rotulo(STATUS, e.statusRastreamento), e.statusRastreamento === 'BAIXA_DEFINITIVA' ? 'ok' : 'andamento')),
      h('h3', null, 'Histórico'),
      tabela([{ titulo: 'Quando', valor: (x) => data(x.dataHora) }, { titulo: 'De', valor: (x) => rotulo(STATUS, x.origem) }, { titulo: 'Para', valor: (x) => rotulo(STATUS, x.destino) }, { titulo: 'Responsável', valor: (x) => x.responsavel }, { titulo: 'Observação', valor: (x) => x.observacao || '-' }], m));
  }
  if (id) setTimeout(() => buscar(id), 0);
  return h('div', null, cabeca('Rastrear equipamento', 'Veja por onde o equipamento passou e em que etapa ele está.'),
    h('form', { class: 'painel', onsubmit: (ev) => { ev.preventDefault(); if (campo.value.trim()) buscar(campo.value); } },
      h('div', { class: 'campo' }, h('label', { for: 'codigo' }, 'Código do equipamento'), campo), h('div', { class: 'acoes' }, h('button', { type: 'submit' }, 'Rastrear'))),
    h('section', { class: 'bloco' }, alvo));
}

function vNovoLote() {
  const linhas = h('div');
  const resultado = h('div');
  function novaLinha() {
    const l = h('div', { class: 'equip-linha' },
      h('div', null, h('label', null, 'Tipo'), h('select', { 'data-c': 'tipo' }, opcoes(TIPOS))),
      h('div', null, h('label', null, 'Marca'), h('input', { 'data-c': 'marca', maxlength: '80' })),
      h('div', null, h('label', null, 'Modelo'), h('input', { 'data-c': 'modelo', maxlength: '80' })),
      h('div', null, h('label', null, 'Ano'), h('input', { 'data-c': 'ano', type: 'number', min: '1970', max: String(new Date().getFullYear() + 1), value: String(new Date().getFullYear() - 3), required: true })),
      h('div', null, h('label', null, 'Estado'), h('select', { 'data-c': 'estado', value: 'USADO_LEVE' }, opcoes(ESTADOS))),
      h('div', null, h('label', null, 'Peso (kg)'), h('input', { 'data-c': 'peso', type: 'number', step: '0.001', min: '0.001', required: true })),
      h('button', { type: 'button', class: 'perigo mini', 'aria-label': 'Remover equipamento', onclick: () => l.remove() }, 'Remover'));
    linhas.append(l);
  }
  novaLinha();
  async function enviar(ev) {
    ev.preventDefault();
    const equipamentos = [...linhas.children].map((l) => {
      const v = (c) => l.querySelector(`[data-c="${c}"]`).value;
      return { tipo: v('tipo'), marca: v('marca'), modelo: v('modelo'), anoFabricacao: Number(v('ano')), estadoFisico: v('estado'), pesoQuilogramas: Number(v('peso')) };
    });
    const corpo = { notaFiscal: $('#nf').value, transportadora: $('#tr').value, observacoes: $('#ob').value, equipamentos };
    if ($('#de').value) corpo.dataEntrada = $('#de').value;
    const r = await seguro(() => chamar(P('/lotes'), { metodo: 'POST', corpo }));
    if (!r) return;
    aviso('Lote registrado', `Nota fiscal ${r.dados.notaFiscal}.`);
    pintar(resultado, h('div', { class: 'painel' }, h('h3', null, 'Lote registrado'), h('p', null, `Foram cadastrados ${r.dados.equipamentos.length} equipamento(s). Guarde os códigos para rastrear:`),
      tabela([{ titulo: 'Tipo', valor: (e) => rotulo(TIPOS, e.tipo) }, { titulo: 'Código', valor: (e) => e.codigoBarrasInterno }], r.dados.equipamentos), h('p', null, h('a', { href: `#/lotes/${r.dados.id}` }, 'Abrir o lote'))));
    $('#nf').value = ''; pintar(linhas, ); novaLinha();
  }
  return h('div', null, cabeca('Registrar lote', 'Informe os dados da nota fiscal e liste os equipamentos enviados. O lote entra na sua organização.'),
    h('form', { class: 'painel', onsubmit: enviar },
      h('div', { class: 'linha-campos' },
        h('div', { class: 'campo' }, h('label', { for: 'nf' }, 'Nota fiscal'), h('input', { id: 'nf', required: true, maxlength: '60' })),
        h('div', { class: 'campo' }, h('label', { for: 'tr' }, 'Transportadora'), h('input', { id: 'tr', required: true, maxlength: '120' })),
        h('div', { class: 'campo' }, h('label', { for: 'de' }, 'Data de entrada (opcional)'), h('input', { id: 'de', type: 'date' }))),
      h('div', { class: 'campo' }, h('label', { for: 'ob' }, 'Observações'), h('textarea', { id: 'ob', rows: '2', maxlength: '2000' })),
      h('h3', null, 'Equipamentos'), linhas,
      h('div', { class: 'acoes' }, h('button', { type: 'button', class: 'sec', onclick: novaLinha }, 'Adicionar equipamento'), h('button', { type: 'submit' }, 'Registrar lote'))),
    h('section', { class: 'bloco' }, resultado));
}

function vAnalisesParceiro() {
  const alvo = h('div');
  async function ver(tipo) {
    pintar(alvo, h('p', { class: 'vazio' }, 'Calculando...'));
    const r = await seguro(() => chamar(P(`/analises/${tipo}`)));
    pintar(alvo, r ? mostrarAnalise(r.dados) : h('p', { class: 'vazio' }, 'Não foi possível carregar esta análise.'));
  }
  const tipoSel = h('select', { id: 'tipo', onchange: (e) => ver(e.target.value) }, opcoes(ANALISES));
  setTimeout(() => ver(tipoSel.value), 0);
  return h('div', null, cabeca('Análises', 'Indicadores calculados sobre os equipamentos da sua organização. Mostramos a análise mais recente.'), h('div', { class: 'campo', style: 'max-width:300px' }, h('label', { for: 'tipo' }, 'Análise'), tipoSel), h('section', { class: 'bloco' }, alvo));
}

// ---------- telas da equipe interna ----------
function vAnalisesInterno() {
  const alvo = h('div');
  const orgSel = h('select', { id: 'org' }, h('option', { value: '' }, 'Todas as organizações'));
  seguro(() => chamar(I('/organizacoes?limite=200'))).then((r) => r && r.dados.forEach((o) => orgSel.append(h('option', { value: o.id }, o.razaoSocial))));
  const tipoSel = h('select', { id: 'tipo' }, opcoes(ANALISES));
  const historico = h('div');
  async function executar(ev) {
    ev.preventDefault();
    const corpo = {};
    if (orgSel.value) corpo.organizacaoId = orgSel.value;
    if ($('#ini').value) corpo.inicio = $('#ini').value;
    if ($('#fim').value) corpo.fim = $('#fim').value;
    pintar(alvo, h('p', { class: 'vazio' }, 'Calculando...'));
    const r = await seguro(() => chamar(I(`/analises/${tipoSel.value}/executar`), { metodo: 'POST', corpo }));
    pintar(alvo, r ? mostrarAnalise(r.dados) : '');
    if (r) carregarHistorico();
  }
  async function carregarHistorico() {
    const r = await seguro(() => chamar(I(`/analises/historico?limite=10&tipo=${tipoSel.value}`)));
    if (!r) return;
    pintar(historico, tabela([{ titulo: 'Gerada em', valor: (a) => data(a.geradoEm) }, { titulo: 'Origem', valor: (a) => ({ AGENDADA: 'Agendada', MANUAL: 'Manual', TAREFA: 'Relatório' })[a.origem] }, { titulo: 'Escopo', valor: (a) => (a.organizacaoId ? 'Uma organização' : 'Todas') }, { titulo: 'Duração', num: true, valor: (a) => `${a.duracaoMs} ms` }],
      r.dados, { aoClicar: async (a) => { const d = await seguro(() => chamar(I(`/analises/historico/${a.id}`))); if (d) { pintar(alvo, mostrarAnalise(d.dados)); alvo.scrollIntoView({ behavior: 'smooth' }); } }, vazio: 'Ainda não há análises deste tipo.' }));
  }
  tipoSel.addEventListener('change', carregarHistorico);
  setTimeout(carregarHistorico, 0);
  return h('div', null, cabeca('Análises', 'Calcule agora ou consulte o histórico. As análises também rodam sozinhas todos os dias de madrugada.'),
    h('form', { class: 'painel', onsubmit: executar }, h('div', { class: 'linha-campos' },
      h('div', { class: 'campo' }, h('label', { for: 'tipo' }, 'Análise'), tipoSel), h('div', { class: 'campo' }, h('label', { for: 'org' }, 'Organização'), orgSel),
      h('div', { class: 'campo' }, h('label', { for: 'ini' }, 'De (opcional)'), h('input', { id: 'ini', type: 'date' })), h('div', { class: 'campo' }, h('label', { for: 'fim' }, 'Até (opcional)'), h('input', { id: 'fim', type: 'date' }))),
      h('div', { class: 'acoes' }, h('button', { type: 'submit' }, 'Calcular agora'))),
    h('section', { class: 'bloco' }, alvo), h('section', { class: 'bloco' }, h('h2', null, 'Histórico'), historico));
}

function vChaves() {
  const lista = h('div'); const novo = h('div');
  const orgSel = h('select', { id: 'org', required: true });
  seguro(() => chamar(I('/organizacoes?limite=200'))).then((r) => r && r.dados.forEach((o) => orgSel.append(h('option', { value: o.id }, o.razaoSocial))));
  async function carregar() {
    const r = await seguro(() => chamar(A('/chaves-api?limite=100')));
    if (!r) return;
    pintar(lista, tabela([{ titulo: 'Nome', valor: (c) => c.nome }, { titulo: 'Prefixo', valor: (c) => `gck_${c.prefixo}_...` }, { titulo: 'Permissões', valor: (c) => c.permissoes.map((p) => rotulo(PERMISSOES, p)).join('; ') }, { titulo: 'Limite/min', num: true, valor: (c) => c.limitePorMinuto }, { titulo: 'Último uso', valor: (c) => data(c.ultimoUsoEm) }, { titulo: 'Situação', valor: (c) => selo(c.ativa ? 'Ativa' : 'Revogada', c.ativa ? 'ok' : 'erro') },
      { titulo: '', valor: (c) => h('span', { class: 'acoes' },
        h('button', { class: 'sec mini', onclick: () => alternar(c) }, c.ativa ? 'Revogar' : 'Reativar'),
        h('button', { class: 'sec mini', onclick: () => rotacionar(c) }, 'Trocar chave')) }], r.dados, { vazio: 'Nenhuma chave criada ainda.' }));
  }
  const mostrarChave = (r, titulo) => pintar(novo, h('div', { class: 'painel' }, h('h3', null, titulo), h('p', null, 'Copie agora e entregue ao parceiro. Por segurança, esta chave não será mostrada de novo.'), h('div', { class: 'chave-nova' }, r.chave), h('button', { class: 'sec', onclick: () => navigator.clipboard && navigator.clipboard.writeText(r.chave).then(() => aviso('Copiada', 'A chave foi copiada.')) }, 'Copiar chave')));
  async function alternar(c) {
    if (c.ativa && !confirm(`Revogar a chave "${c.nome}"? O parceiro perde o acesso na hora.`)) return;
    if (await seguro(() => chamar(A(`/chaves-api/${c.id}/ativa`), { metodo: 'PATCH', corpo: { ativa: !c.ativa, versao: c.versao } }))) { aviso(c.ativa ? 'Chave revogada' : 'Chave reativada'); carregar(); }
  }
  async function rotacionar(c) {
    if (!confirm(`Gerar uma chave nova para "${c.nome}"? A atual deixa de funcionar.`)) return;
    const r = await seguro(() => chamar(A(`/chaves-api/${c.id}/rotacionar`), { metodo: 'POST', corpo: { versao: c.versao } }));
    if (r) { mostrarChave(r.dados, 'Chave nova gerada'); carregar(); }
  }
  async function criar(ev) {
    ev.preventDefault();
    const permissoes = [...document.querySelectorAll('input[name=perm]:checked')].map((i) => i.value);
    if (!permissoes.length) { aviso('Escolha ao menos uma permissão', 'A chave precisa de algo liberado.', 'erro'); return; }
    const corpo = { nome: $('#nome').value, organizacaoId: orgSel.value, permissoes, limitePorMinuto: Number($('#lim').value) };
    if ($('#exp').value) corpo.expiraEm = new Date($('#exp').value + 'T23:59:59').toISOString();
    const r = await seguro(() => chamar(A('/chaves-api'), { metodo: 'POST', corpo }));
    if (r) { mostrarChave(r.dados, 'Chave criada'); carregar(); ev.target.reset(); }
  }
  setTimeout(carregar, 0);
  return h('div', null, cabeca('Chaves de API', 'Cada parceiro acessa a API pública com uma chave própria, ligada a uma organização.'),
    h('form', { class: 'painel', onsubmit: criar },
      h('div', { class: 'linha-campos' },
        h('div', { class: 'campo' }, h('label', { for: 'nome' }, 'Nome da chave'), h('input', { id: 'nome', required: true, minlength: '3', maxlength: '120', placeholder: 'Ex.: Sistema de ativos do parceiro' })),
        h('div', { class: 'campo' }, h('label', { for: 'org' }, 'Organização'), orgSel),
        h('div', { class: 'campo' }, h('label', { for: 'lim' }, 'Requisições por minuto'), h('input', { id: 'lim', type: 'number', min: '1', max: '10000', value: '60', required: true })),
        h('div', { class: 'campo' }, h('label', { for: 'exp' }, 'Vale até (opcional)'), h('input', { id: 'exp', type: 'date' }))),
      h('fieldset', { style: 'border:1px solid var(--linha);border-radius:4px;margin:0 0 .8rem' }, h('legend', null, 'Permissões'),
        Object.entries(PERMISSOES).map(([k, v]) => h('label', { style: 'display:flex;gap:.5rem;color:inherit;font-size:.95rem' }, h('input', { type: 'checkbox', name: 'perm', value: k, style: 'width:auto', checked: k === 'LER_RASTREABILIDADE' }), v))),
      h('div', { class: 'acoes' }, h('button', { type: 'submit' }, 'Criar chave'))),
    h('section', { class: 'bloco' }, novo), h('section', { class: 'bloco' }, h('h2', null, 'Chaves existentes'), lista));
}

function vFila() {
  const resumo = h('div'); const lista = h('div');
  async function carregar() {
    const [a, b] = await Promise.all([seguro(() => chamar(A('/fila/resumo'))), seguro(() => chamar(A('/fila/tarefas?limite=20')))]);
    if (a) pintar(resumo, indicadores(Object.entries(a.dados).map(([k, v]) => [rotulo(Object.fromEntries(Object.entries(STATUS_TAREFA).map(([s, t]) => [s, t[0]])), k), v])));
    if (b) pintar(lista, tabela([{ titulo: 'Relatório', valor: (t) => `${rotulo(ANALISES, t.tipo)} (${t.formato})` }, { titulo: 'Pedido por', valor: (t) => t.solicitadoPor }, { titulo: 'Pedido em', valor: (t) => data(t.criadoEm) }, { titulo: 'Tentativas', num: true, valor: (t) => `${t.tentativas}/${t.maxTentativas}` }, { titulo: 'Situação', valor: (t) => selo((STATUS_TAREFA[t.status] || [t.status])[0], (STATUS_TAREFA[t.status] || [])[1]) }, { titulo: 'Erro', valor: (t) => t.erro || '' },
      { titulo: '', valor: (t) => (t.status === 'FALHA' ? h('button', { class: 'sec mini', onclick: async () => { if (await seguro(() => chamar(A(`/fila/tarefas/${t.id}/reenfileirar`), { metodo: 'POST' }))) { aviso('Tarefa recolocada na fila'); carregar(); } } }, 'Tentar de novo') : null) }], b.dados, { vazio: 'A fila está vazia.' }));
  }
  async function agendadas() {
    const r = await seguro(() => chamar(A('/analises/executar-agendadas'), { metodo: 'POST' }));
    if (r) aviso('Análises executadas', `${r.dados.executadas} concluída(s), ${r.dados.falhas.length} falha(s).`, r.dados.falhas.length ? 'erro' : 'ok');
  }
  setTimeout(carregar, 0);
  return h('div', null, cabeca('Fila de relatórios', 'Situação dos relatórios pedidos por parceiros e pela equipe.'), resumo,
    h('div', { class: 'acoes' }, h('button', { class: 'sec', onclick: carregar }, 'Atualizar'), h('button', { class: 'sec', onclick: agendadas }, 'Rodar análises agendadas agora')),
    h('section', { class: 'bloco' }, lista));
}

// ---------- navegação ----------
function menu() {
  if (sessao.modo === 'parceiro') {
    return [['inicio', 'Início', vInicioParceiro, true], ['lotes', 'Lotes', vLotes, tem('LER_RASTREABILIDADE')], ['rastrear', 'Rastrear equipamento', vRastrear, tem('LER_RASTREABILIDADE')], ['novo-lote', 'Registrar lote', vNovoLote, tem('ESCREVER_LOTES')], ['analises', 'Análises', vAnalisesParceiro, tem('LER_RELATORIOS')], ['relatorios', 'Relatórios', vRelatorios, tem('LER_RELATORIOS')]].filter((m) => m[3]);
  }
  const t = interno();
  const adm = t.eh('SUPERUSUARIO', 'ADMINISTRADOR');
  const aud = t.podeAuditar();
  return [['inicio', 'Início', t.vInicio, true], ['usuarios', 'Usuários', t.vUsuarios, t.ehSuper()], ['organizacoes', 'Organizações', t.vOrganizacoes, true], ['lotes', 'Lotes', t.vLotes, true], ['equipamentos', 'Equipamentos', t.vEquipamentos, true],
    ['relatorios', 'Relatórios', t.vRelatorios, true], ['auditoria', 'Auditoria', t.vAuditoria, aud], ['analises', 'Análises', vAnalisesInterno, aud], ['pedidos', 'Pedidos de relatório', vRelatorios, aud],
    ['chaves', 'Chaves de API', vChaves, adm], ['fila', 'Fila', vFila, adm], ['conta', 'Minha conta', t.vConta, true]].filter((m) => m[3]);
}

// Tudo o que as telas da equipe interna (interno.js) precisam do núcleo.
const GC = { h, $, pintar, num, reais, pct, data, chamar, seguro, baixar, aviso, tabela, indicadores, selo, cabeca, opcoes, rotulo, STATUS, TIPOS, ESTADOS, LOTES, I, A, sessao: () => sessao, salvarSessao, redesenhar: () => desenhar() };
let internoCache = null;
function interno() {
  if (!internoCache) { internoCache = window.GC_INTERNO(GC); internoCache.eh = (...p) => p.includes(sessao.papel); }
  return internoCache;
}

function atualizarLimite() {
  const el = $('#limite');
  if (!el || !limiteVisto) return;
  el.replaceChildren(h('span', { style: `width:${(limiteVisto.restante / limiteVisto.limite) * 100}%` }));
  el.title = `${limiteVisto.restante} de ${limiteVisto.limite} requisições restantes neste minuto`;
  const t = $('#limite-txt'); if (t) t.textContent = `${limiteVisto.restante} de ${limiteVisto.limite} requisições neste minuto`;
}

function desenharApp() {
  const itens = menu();
  const [rota, id] = location.hash.replace(/^#\//, '').split('/');
  const atual = itens.find((m) => m[0] === rota) || itens[0];
  clearTimeout(temporizador);
  const conteudo = h('main', { id: 'conteudo', tabindex: '-1' }, atual[2](id));
  $('#raiz').replaceChildren(h('div', { class: 'app' },
    h('aside', { class: 'lateral' },
      h('div', { class: 'marca' }, 'Greencode', h('small', null, sessao.modo === 'parceiro' ? 'Portal do parceiro' : 'Equipe interna')),
      h('nav', { 'aria-label': 'Principal' }, itens.map((m) => h('a', { href: `#/${m[0]}`, 'aria-current': m === atual ? 'page' : null }, m[1]))),
      h('div', { class: 'rodape' }, sessao.modo === 'parceiro' ? [h('div', { id: 'limite-txt' }, 'Limite de requisições'), h('div', { class: 'limite', id: 'limite' })] : null, h('div', null, sessao.nome || sessao.usuario), h('button', { onclick: sair }, 'Sair'))),
    conteudo));
  atualizarLimite();
}

function sair() { clearTimeout(temporizador); sessao = null; salvarSessao(); limiteVisto = null; location.hash = ''; desenhar(); }

// ---------- entrada ----------
function desenharEntrada() {
  let aba = 'parceiro';
  const form = h('div');
  const pintar = () => {
    form.replaceChildren(aba === 'parceiro'
      ? h('form', { onsubmit: entrarParceiro }, h('p', { class: 'suave' }, 'Use a chave de API que a equipe do Greencode entregou à sua organização.'), h('div', { class: 'campo' }, h('label', { for: 'chave' }, 'Chave de API'), h('input', { id: 'chave', type: 'password', autocomplete: 'off', required: true, placeholder: 'gck_...' })), h('div', { class: 'acoes' }, h('button', { type: 'submit' }, 'Entrar')))
      : h('form', { onsubmit: entrarInterno }, h('div', { class: 'campo' }, h('label', { for: 'usuario' }, 'Usuário'), h('input', { id: 'usuario', autocomplete: 'username', required: true })), h('div', { class: 'campo' }, h('label', { for: 'senha' }, 'Senha'), h('input', { id: 'senha', type: 'password', autocomplete: 'current-password', required: true })), h('div', { class: 'acoes' }, h('button', { type: 'submit' }, 'Entrar'))));
    abas.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
  };
  const abas = h('div', { class: 'abas', role: 'tablist' },
    h('button', { role: 'tab', 'data-aba': 'parceiro', onclick: () => { aba = 'parceiro'; pintar(); } }, 'Sou parceiro'),
    h('button', { role: 'tab', 'data-aba': 'interno', onclick: () => { aba = 'interno'; pintar(); } }, 'Equipe interna'));
  pintar();
  $('#raiz').replaceChildren(h('div', { class: 'entrada' },
    h('section', { class: 'historia' }, h('h1', null, 'Cada equipamento, do recebimento à baixa.'), h('p', null, 'Acompanhe o caminho dos seus eletrônicos descartados, registre novos lotes e consulte quanto material foi recuperado.'),
      h('ol', { class: 'trilha', 'aria-hidden': 'true' }, ETAPAS.map(([nome], i) => h('li', { class: 'feito', style: `--i:${i}` }, h('span', null, nome))))),
    h('section', { class: 'acesso' }, h('h2', null, 'Entrar'), abas, form, h('p', { class: 'suave', style: 'margin-top:1.4rem' }, 'Desenvolvedor? A documentação da API está no ', h('a', { href: '/docs' }, 'Swagger'), '.'))));
}

async function entrarParceiro(ev) {
  ev.preventDefault();
  sessao = { modo: 'parceiro', chave: $('#chave').value.trim() };
  const r = await seguro(() => chamar(P('/eu')));
  if (!r) { sessao = null; return; }
  sessao = { ...sessao, nome: r.dados.chave, organizacaoId: r.dados.organizacaoId, permissoes: r.dados.permissoes, id: r.dados.organizacaoId + r.dados.chave };
  salvarSessao(); location.hash = '#/inicio'; desenhar();
}

async function entrarInterno(ev) {
  ev.preventDefault();
  sessao = { modo: 'interno' };
  const login = await seguro(() => chamar(I('/auth/login'), { metodo: 'POST', corpo: { usuario: $('#usuario').value, senha: $('#senha').value } }));
  if (!login) { sessao = null; return; }
  sessao.token = login.dados.token;
  const eu = await seguro(() => chamar(I('/auth/me')));
  if (!eu) { sessao = null; return; }
  sessao = { ...sessao, usuario: eu.dados.usuario, nome: eu.dados.nome, papel: eu.dados.papel, id: eu.dados.id };
  salvarSessao(); location.hash = '#/inicio'; desenhar();
}

function desenhar() { if (sessao) desenharApp(); else desenharEntrada(); }
document.body.append(h('div', { id: 'avisos', 'aria-live': 'polite' }));
window.addEventListener('hashchange', () => { if (sessao) desenharApp(); });
desenhar();

// Arthur Oliver Rossi Alves, autor do Greencode.
