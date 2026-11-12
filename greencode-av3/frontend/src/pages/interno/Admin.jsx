// Chaves de API dos parceiros e fila de relatórios (administração).
import { useState } from 'react';
import { A, I, avisar, chamar, seguro } from '../../lib/api.js';
import { useCarregar } from '../../lib/hooks.js';
import { ANALISES, PERMISSOES, STATUS_TAREFA, data, rotulo } from '../../lib/rotulos.js';
import { Acoes, Botao, Cabeca, Campo, Carregando, Entrada, H2, Indicadores, LinhaCampos, Painel, Selo, Seletor, Tabela } from '../../components/ui.jsx';

export function Chaves() {
  const orgs = useCarregar(() => chamar(I('/organizacoes?limite=200')), []);
  const lista = useCarregar(() => chamar(A('/chaves-api?limite=100')), []);
  const [f, setF] = useState({ nome: '', org: '', lim: '60', exp: '', perm: ['LER_RASTREABILIDADE'] });
  const [nova, setNova] = useState(null); // { titulo, chave }
  const campo = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const opcoesOrg = Object.fromEntries((orgs.dados || []).filter((o) => o.ativo).map((o) => [o.id, o.razaoSocial]));
  const orgEscolhida = f.org || Object.keys(opcoesOrg)[0] || '';
  const marcar = (k) => setF((x) => ({ ...x, perm: x.perm.includes(k) ? x.perm.filter((p) => p !== k) : [...x.perm, k] }));

  async function criar(ev) {
    ev.preventDefault();
    if (!f.perm.length) { avisar('Escolha ao menos uma permissão', 'A chave precisa de algo liberado.', 'erro'); return; }
    const corpo = { nome: f.nome, organizacaoId: orgEscolhida, permissoes: f.perm, limitePorMinuto: Number(f.lim) };
    if (f.exp) corpo.expiraEm = new Date(`${f.exp}T23:59:59`).toISOString();
    const r = await seguro(() => chamar(A('/chaves-api'), { metodo: 'POST', corpo }));
    if (r) { setNova({ titulo: 'Chave criada', chave: r.dados.chave }); lista.recarregar(); setF((x) => ({ ...x, nome: '' })); }
  }
  async function alternar(c) {
    if (c.ativa && !window.confirm(`Revogar a chave "${c.nome}"? O parceiro perde o acesso na hora.`)) return;
    if (await seguro(() => chamar(A(`/chaves-api/${c.id}/ativa`), { metodo: 'PATCH', corpo: { ativa: !c.ativa, versao: c.versao } }))) { avisar(c.ativa ? 'Chave revogada' : 'Chave reativada'); lista.recarregar(); }
  }
  async function rotacionar(c) {
    if (!window.confirm(`Gerar uma chave nova para "${c.nome}"? A atual deixa de funcionar.`)) return;
    const r = await seguro(() => chamar(A(`/chaves-api/${c.id}/rotacionar`), { metodo: 'POST', corpo: { versao: c.versao } }));
    if (r) { setNova({ titulo: 'Chave nova gerada', chave: r.dados.chave }); lista.recarregar(); }
  }
  return (
    <div>
      <Cabeca titulo="Chaves de API" texto="Cada parceiro acessa a API pública com uma chave própria, ligada a uma organização." />
      <Painel>
        <form onSubmit={criar}>
          <LinhaCampos>
            <Campo rotulo="Nome da chave">{(i) => <Entrada id={i} required minLength={3} maxLength={120} placeholder="Ex.: Sistema de ativos do parceiro" value={f.nome} onChange={campo('nome')} />}</Campo>
            <Campo rotulo="Organização">{(i) => <Seletor id={i} required opcoes={opcoesOrg} value={orgEscolhida} onChange={campo('org')} />}</Campo>
            <Campo rotulo="Requisições por minuto">{(i) => <Entrada id={i} type="number" min={1} max={10000} required value={f.lim} onChange={campo('lim')} />}</Campo>
            <Campo rotulo="Vale até (opcional)">{(i) => <Entrada id={i} type="date" value={f.exp} onChange={campo('exp')} />}</Campo>
          </LinhaCampos>
          <fieldset className="mb-4 border-2 border-linha border-l-[8px] border-l-sinal bg-superficie px-4 py-3">
            <legend className="px-1 text-[0.9rem] text-suave">Permissões</legend>
            {Object.entries(PERMISSOES).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 py-0.5"><input type="checkbox" className="h-4 w-4" checked={f.perm.includes(k)} onChange={() => marcar(k)} /> {v}</label>
            ))}
          </fieldset>
          <Acoes><Botao type="submit">Criar chave</Botao></Acoes>
        </form>
      </Painel>
      {nova && (
        <Painel>
          <h3 className="m-0 mb-1 w-fit border-b-2 border-acao font-mono text-[0.9rem] font-semibold uppercase tracking-[0.1em]">{nova.titulo}</h3>
          <p>Copie agora e entregue ao parceiro. Por segurança, esta chave não será mostrada de novo.</p>
          <code className="block break-all border-2 border-dashed border-acao bg-papel p-3 font-mono text-[0.85rem]">{nova.chave}</code>
          <Acoes>
            <Botao variante="sec" onClick={() => navigator.clipboard && navigator.clipboard.writeText(nova.chave).then(() => avisar('Copiada', 'A chave foi copiada.'))}>Copiar chave</Botao>
            <Botao variante="sec" onClick={() => setNova(null)}>Já guardei</Botao>
          </Acoes>
        </Painel>
      )}
      <H2>Chaves existentes</H2>
      {lista.carregando && !lista.dados ? <Carregando /> : (
        <Tabela vazio="Nenhuma chave criada ainda." linhas={lista.dados} colunas={[
          { titulo: 'Nome', ver: (c) => c.nome }, { titulo: 'Prefixo', ver: (c) => `gck_${c.prefixo}_...` }, { titulo: 'Permissões', ver: (c) => c.permissoes.map((p) => rotulo(PERMISSOES, p)).join('; ') },
          { titulo: 'Limite/min', num: true, ver: (c) => c.limitePorMinuto }, { titulo: 'Último uso', ver: (c) => data(c.ultimoUsoEm) }, { titulo: 'Situação', ver: (c) => <Selo tipo={c.ativa ? 'ok' : 'erro'}>{c.ativa ? 'Ativa' : 'Revogada'}</Selo> },
          { titulo: '', ver: (c) => <span className="flex flex-wrap gap-1.5"><Botao mini variante="sec" onClick={() => alternar(c)}>{c.ativa ? 'Revogar' : 'Reativar'}</Botao><Botao mini variante="sec" onClick={() => rotacionar(c)}>Trocar chave</Botao></span> }]} />
      )}
    </div>
  );
}

export function Fila() {
  const resumo = useCarregar(() => chamar(A('/fila/resumo')), []);
  const tarefas = useCarregar(() => chamar(A('/fila/tarefas?limite=20')), []);
  const nomes = Object.fromEntries(Object.entries(STATUS_TAREFA).map(([s, t]) => [s, t[0]]));
  const atualizar = () => { resumo.recarregar(); tarefas.recarregar(); };
  return (
    <div>
      <Cabeca titulo="Fila de relatórios" texto="Situação dos relatórios pedidos por parceiros e pela equipe." />
      {/* a API devolve { porStatus: { PENDENTE: n, ... } }; status sem tarefas não aparecem, então completamos com zero */}
      {resumo.dados && <Indicadores itens={Object.keys(STATUS_TAREFA).map((k) => [rotulo(nomes, k), (resumo.dados.porStatus || {})[k] || 0])} />}
      <Acoes className="mb-3"><Botao variante="sec" onClick={atualizar}>Atualizar</Botao></Acoes>
      {tarefas.carregando && !tarefas.dados ? <Carregando /> : (
        <Tabela vazio="A fila está vazia." linhas={tarefas.dados} colunas={[
          { titulo: 'Relatório', ver: (t) => `${rotulo(ANALISES, t.tipo)} (${t.formato})` }, { titulo: 'Pedido por', ver: (t) => t.solicitadoPor }, { titulo: 'Pedido em', ver: (t) => data(t.criadoEm) },
          { titulo: 'Tentativas', num: true, ver: (t) => `${t.tentativas}/${t.maxTentativas}` }, { titulo: 'Situação', ver: (t) => <Selo tipo={(STATUS_TAREFA[t.status] || [])[1]}>{(STATUS_TAREFA[t.status] || [t.status])[0]}</Selo> },
          { titulo: 'Erro', ver: (t) => t.erro || '' },
          { titulo: '', ver: (t) => (t.status === 'FALHA' ? <Botao mini variante="sec" onClick={async () => { if (await seguro(() => chamar(A(`/fila/tarefas/${t.id}/reenfileirar`), { metodo: 'POST' }))) { avisar('Tarefa recolocada na fila'); atualizar(); } }}>Tentar de novo</Botao> : null) }]} />
      )}
    </div>
  );
}

// Arthur Oliver Rossi Alves, autor do Greencode.
