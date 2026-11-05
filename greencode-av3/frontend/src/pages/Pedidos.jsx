import { useCallback, useEffect, useRef, useState } from 'react';
import { I, P, avisar, baixar, chamar, obterSessao, seguro } from '../lib/api.js';
import { useCarregar } from '../lib/hooks.js';
import { ANALISES, STATUS_TAREFA, data, rotulo } from '../lib/rotulos.js';
import { Acoes, Botao, Cabeca, Campo, Entrada, H2, LinhaCampos, Painel, Selo, Seletor, Tabela } from '../components/ui.jsx';

// Relatórios pesados rodam em segundo plano: o pedido entra na fila, a tela acompanha o andamento e libera o download.
// A lista de pedidos fica guardada neste navegador (a API devolve a tarefa pelo id).
const chaveLocal = () => { const s = obterSessao(); return `gc_tarefas_${s.modo}_${s.id || 'x'}`; };
const lerTarefas = () => { try { return JSON.parse(localStorage.getItem(chaveLocal()) || '[]'); } catch { return []; } };
const gravarTarefas = (l) => { try { localStorage.setItem(chaveLocal(), JSON.stringify(l.slice(0, 30))); } catch { /* sem armazenamento */ } };

export default function Pedidos() {
  const interno = obterSessao().modo === 'interno';
  const base = interno ? I('/relatorios-assincronos') : P('/relatorios');
  const [tarefas, setTarefas] = useState(lerTarefas);
  const [form, setForm] = useState({ tipo: 'EFICIENCIA', formato: 'CSV', ini: '', fim: '', org: '' });
  const [enviando, setEnviando] = useState(false);
  const orgs = useCarregar(() => (interno ? chamar(I('/organizacoes?limite=200')) : Promise.resolve(null)), []);
  const timer = useRef(null);
  const campo = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const atualizar = useCallback(async () => {
    const atuais = lerTarefas();
    let pendente = false;
    for (const t of atuais) {
      if (t.status === 'CONCLUIDA' || t.status === 'FALHA') continue;
      try {
        Object.assign(t, (await chamar(`${base}/${t.id}`)).dados);
      } catch (e) {
        if (e.status === 404) t.status = 'FALHA';
      }
      if (t.status !== 'CONCLUIDA' && t.status !== 'FALHA') pendente = true;
    }
    gravarTarefas(atuais);
    setTarefas(atuais);
    clearTimeout(timer.current);
    if (pendente) timer.current = setTimeout(atualizar, 2000);
  }, [base]);

  useEffect(() => { atualizar(); return () => clearTimeout(timer.current); }, [atualizar]);

  async function pedir(ev) {
    ev.preventDefault();
    const corpo = { tipo: form.tipo, formato: form.formato };
    if (form.ini) corpo.inicio = form.ini;
    if (form.fim) corpo.fim = form.fim;
    if (interno && form.org) corpo.organizacaoId = form.org;
    setEnviando(true);
    const r = await seguro(() => chamar(base, { metodo: 'POST', corpo }));
    setEnviando(false);
    if (!r) return;
    gravarTarefas([r.dados, ...lerTarefas()]);
    avisar('Relatório pedido', 'Ele será gerado em segundo plano. Esta lista atualiza sozinha.');
    atualizar();
  }
  const opcoesOrg = Object.fromEntries(((orgs.dados) || []).map((o) => [o.id, o.razaoSocial]));

  return (
    <div>
      <Cabeca titulo={interno ? 'Pedidos de relatório' : 'Relatórios'} texto="Peça um relatório, acompanhe o andamento e baixe o arquivo quando estiver pronto. Pedidos grandes não travam a tela: rodam em segundo plano." />
      <Painel>
        <form onSubmit={pedir}>
          <LinhaCampos>
            <Campo rotulo="Relatório">{(id) => <Seletor id={id} opcoes={ANALISES} value={form.tipo} onChange={campo('tipo')} />}</Campo>
            <Campo rotulo="Formato">{(id) => <Seletor id={id} opcoes={{ CSV: 'CSV (abre no Excel)', JSON: 'JSON' }} value={form.formato} onChange={campo('formato')} />}</Campo>
            <Campo rotulo="De (opcional)">{(id) => <Entrada id={id} type="date" value={form.ini} onChange={campo('ini')} />}</Campo>
            <Campo rotulo="Até (opcional)">{(id) => <Entrada id={id} type="date" value={form.fim} onChange={campo('fim')} />}</Campo>
            {interno && <Campo rotulo="Organização">{(id) => <Seletor id={id} opcoes={opcoesOrg} vazio="Todas as organizações" value={form.org} onChange={campo('org')} />}</Campo>}
          </LinhaCampos>
          <Acoes><Botao type="submit" disabled={enviando}>Pedir relatório</Botao></Acoes>
        </form>
      </Painel>
      <H2>Seus pedidos</H2>
      <Tabela vazio="Você ainda não pediu nenhum relatório neste navegador." linhas={tarefas} colunas={[
        { titulo: 'Relatório', ver: (t) => `${rotulo(ANALISES, t.tipo)} (${t.formato})` },
        { titulo: 'Pedido em', ver: (t) => data(t.criadoEm) },
        { titulo: 'Situação', ver: (t) => {
          const [txt, cls] = STATUS_TAREFA[t.status] || [t.status, ''];
          return (<span><Selo tipo={cls}>{txt}</Selo>{t.status === 'PENDENTE' && t.tentativas > 0 ? ` nova tentativa ${t.tentativas}/${t.maxTentativas}` : ''}{t.status === 'FALHA' && t.erro ? ` ${t.erro}` : ''}</span>);
        } },
        { titulo: '', ver: (t) => (t.status === 'CONCLUIDA' ? <Botao mini variante="sec" onClick={() => baixar(`${base}/${t.id}/download`, t.nomeArquivo || `relatorio.${t.formato.toLowerCase()}`)}>Baixar</Botao> : null) }]} />
    </div>
  );
}

// Arthur Oliver Rossi Alves, autor do Greencode.
