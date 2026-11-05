import { useState } from 'react';
import { I, avisar, chamar, seguro } from '../../lib/api.js';
import { ir, useCarregar } from '../../lib/hooks.js';
import { podeAlmox } from '../../lib/papeis.js';
import { ESTADOS, LOTES, TIPOS, STATUS, data, dia, hoje, num, qs, rotulo } from '../../lib/rotulos.js';
import { Acoes, AreaTexto, Botao, Cabeca, Campo, Carregando, Dialogo, Entrada, FormModal, H2, H3, Indicadores, LinhaCampos, ListaPaginada, Painel, Selo, SeloStatus, Seletor, Tabela, Vazio, Voltar } from '../../components/ui.jsx';
import { LinhasEquip, useLinhasEquip } from '../../components/LinhasEquip.jsx';

export default function Lotes({ id }) {
  if (id === 'novo') return <LoteNovo />;
  return id ? <Lote id={id} /> : <Lista />;
}

function Lista() {
  const [status, setStatus] = useState('');
  const [ativo, setAtivo] = useState('true');
  const [org, setOrg] = useState('');
  const orgs = useCarregar(() => chamar(I('/organizacoes?limite=200')), []);
  const opcoesOrg = Object.fromEntries((orgs.dados || []).map((o) => [o.id, o.razaoSocial]));
  return (
    <div>
      <Cabeca titulo="Lotes" texto="Cada lote chega com uma nota fiscal e passa pela triagem." />
      {podeAlmox() && <Acoes className="mb-3"><Botao onClick={() => ir('lotes/novo')}>Registrar lote</Botao></Acoes>}
      <LinhaCampos>
        <Campo rotulo="Situação do lote">{(i) => <Seletor id={i} opcoes={LOTES} vazio="Todos" value={status} onChange={(e) => setStatus(e.target.value)} />}</Campo>
        <Campo rotulo="Cadastro">{(i) => <Seletor id={i} opcoes={{ true: 'Ativos', false: 'Inativos' }} vazio="Todos" value={ativo} onChange={(e) => setAtivo(e.target.value)} />}</Campo>
        <Campo rotulo="Organização">{(i) => <Seletor id={i} opcoes={opcoesOrg} vazio="Todas" value={org} onChange={(e) => setOrg(e.target.value)} />}</Campo>
      </LinhaCampos>
      <ListaPaginada deps={[status, ativo, org]} vazio="Nenhum lote encontrado." aoClicar={(l) => ir(`lotes/${l.id}`)}
        buscar={(pagina, limite) => chamar(I(`/lotes?${qs({ pagina, limite, status, ativo, organizacaoId: org })}`))}
        colunas={[
          { titulo: 'Nota fiscal', ver: (l) => l.notaFiscal }, { titulo: 'Organização', ver: (l) => (l.organizacao ? l.organizacao.razaoSocial : '-') }, { titulo: 'Entrada', ver: (l) => data(l.dataEntrada) },
          { titulo: 'Equipamentos', num: true, ver: (l) => (l._count ? l._count.equipamentos : '-') }, { titulo: 'Situação', ver: (l) => <Selo>{rotulo(LOTES, l.statusProcessamento)}</Selo> },
          { titulo: '', ver: (l) => (l.ativo ? null : <Selo tipo="erro">Inativo</Selo>) }]} />
    </div>
  );
}

function LoteNovo() {
  const eq = useLinhasEquip();
  const orgs = useCarregar(() => chamar(I('/organizacoes?limite=200')), []);
  const [f, setF] = useState({ org: '', nf: '', tr: '', de: '', ob: '' });
  const [enviando, setEnviando] = useState(false);
  const campo = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const ativas = (orgs.dados || []).filter((o) => o.ativo);
  const opcoesOrg = Object.fromEntries(ativas.map((o) => [o.id, `${o.razaoSocial}${o.contratoVigente ? '' : ' (sem contrato vigente)'}`]));

  async function enviar(ev) {
    ev.preventDefault();
    const corpo = { organizacaoId: f.org || ativas[0]?.id, notaFiscal: f.nf, transportadora: f.tr, observacoes: f.ob || undefined, equipamentos: eq.valores() };
    if (f.de) corpo.dataEntrada = f.de;
    setEnviando(true);
    const r = await seguro(() => chamar(I('/lotes'), { metodo: 'POST', corpo }));
    setEnviando(false);
    if (r) { avisar('Lote registrado', `Nota fiscal ${r.dados.notaFiscal}.`); ir(`lotes/${r.dados.id}`); }
  }
  return (
    <div>
      <Voltar para="lotes">Voltar para os lotes</Voltar>
      <Cabeca titulo="Registrar lote" texto="A organização precisa estar ativa e ter contrato vigente. Os equipamentos podem ser adicionados agora ou depois, até a triagem." />
      <Painel>
        <form onSubmit={enviar}>
          <LinhaCampos>
            <Campo rotulo="Organização">{(i) => <Seletor id={i} required opcoes={opcoesOrg} value={f.org || ativas[0]?.id || ''} onChange={campo('org')} />}</Campo>
            <Campo rotulo="Nota fiscal">{(i) => <Entrada id={i} required maxLength={60} value={f.nf} onChange={campo('nf')} />}</Campo>
            <Campo rotulo="Transportadora">{(i) => <Entrada id={i} required maxLength={120} value={f.tr} onChange={campo('tr')} />}</Campo>
            <Campo rotulo="Data de entrada (opcional)">{(i) => <Entrada id={i} type="date" max={hoje()} value={f.de} onChange={campo('de')} />}</Campo>
          </LinhaCampos>
          <Campo rotulo="Observações">{(i) => <AreaTexto id={i} rows={2} maxLength={2000} value={f.ob} onChange={campo('ob')} />}</Campo>
          <H3 className="mt-2">Equipamentos</H3>
          <LinhasEquip estado={eq} />
          <Acoes className="mt-4"><Botao variante="sec" onClick={eq.adicionar}>Adicionar equipamento</Botao><Botao type="submit" disabled={enviando}>Registrar lote</Botao></Acoes>
        </form>
      </Painel>
    </div>
  );
}

function AdicionarEquipamentos({ id, versao, aoFechar, aoConcluir }) {
  const eq = useLinhasEquip();
  const [enviando, setEnviando] = useState(false);
  async function enviar(ev) {
    ev.preventDefault();
    setEnviando(true);
    const r = await seguro(() => chamar(I(`/lotes/${id}/equipamentos`), { metodo: 'POST', corpo: { versao, equipamentos: eq.valores() } }));
    setEnviando(false);
    if (r) { avisar('Equipamentos adicionados'); aoConcluir(); aoFechar(); }
  }
  return (
    <Dialogo titulo="Adicionar equipamentos" aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        <LinhasEquip estado={eq} />
        <Acoes className="mt-4"><Botao variante="sec" onClick={eq.adicionar}>Mais uma linha</Botao><Botao type="submit" disabled={enviando}>Adicionar</Botao><Botao variante="sec" onClick={aoFechar}>Cancelar</Botao></Acoes>
      </form>
    </Dialogo>
  );
}

function Lote({ id }) {
  const { dados: l, carregando, recarregar } = useCarregar(() => chamar(I(`/lotes/${id}`)), [id]);
  const [modal, setModal] = useState(null);
  const pode = podeAlmox();
  const fechar = () => setModal(null);

  async function agir(caminho, metodo, corpo, msg) {
    const r = await seguro(() => chamar(caminho, { metodo, corpo }));
    if (!r) return false;
    if (msg) avisar(msg);
    recarregar();
    return true;
  }
  const recebido = l && l.statusProcessamento === 'RECEBIDO';
  return (
    <div>
      <Voltar para="lotes">Voltar para os lotes</Voltar>
      <Cabeca titulo="Detalhe do lote" />
      {carregando && !l ? <Carregando /> : !l ? <Vazio>Não foi possível abrir este lote.</Vazio> : (
        <>
          <Indicadores itens={[['Nota fiscal', l.notaFiscal], ['Organização', l.organizacao ? l.organizacao.razaoSocial : '-'], ['Entrada', data(l.dataEntrada)], ['Transportadora', l.transportadora], ['Situação', rotulo(LOTES, l.statusProcessamento)], ['Cadastro', l.ativo ? 'Ativo' : 'Inativo'], ['Equipamentos', l.resumo.quantidade], ['Peso total', `${num(l.resumo.pesoTotalKg)} kg`]]} />
          {l.observacoes && <p>{l.observacoes}</p>}
          {pode && (
            <Acoes>
              {recebido && l.ativo && <Botao onClick={() => { if (window.confirm('Processar a triagem? Os equipamentos vão para "Em triagem" e o lote passa a ser derivado deles.')) agir(I(`/lotes/${id}/triagem`), 'POST', { versao: l.versao }, 'Triagem processada'); }}>Processar triagem</Botao>}
              {recebido && l.ativo && <Botao variante="sec" onClick={() => setModal('adicionar')}>Adicionar equipamentos</Botao>}
              <Botao variante="sec" onClick={() => setModal('corrigir')}>Corrigir dados</Botao>
              <Botao variante="sec" onClick={() => { if (!l.ativo || window.confirm('Inativar o lote? Os equipamentos dele também ficam inativos e o lote sai dos relatórios.')) agir(I(`/lotes/${id}/ativo`), 'PATCH', { ativo: !l.ativo, versao: l.versao }, l.ativo ? 'Lote inativado' : 'Lote reativado'); }}>{l.ativo ? 'Inativar' : 'Reativar'}</Botao>
              <Botao variante="perigo" onClick={async () => { if (!window.confirm('Excluir DEFINITIVAMENTE o lote, os equipamentos e as movimentações? Não dá para desfazer.')) return; const r = await seguro(() => chamar(I(`/lotes/${id}?versao=${l.versao}`), { metodo: 'DELETE' })); if (r) { avisar('Lote excluído'); ir('lotes'); } }}>Excluir de vez</Botao>
            </Acoes>
          )}
          <H2>Equipamentos</H2>
          <Tabela vazio="Este lote ainda não tem equipamentos." linhas={l.equipamentos} aoClicar={(e) => ir(`equipamentos/${e.id}`)} colunas={[
            { titulo: '#', num: true, ver: (e) => e.posicaoNoLote }, { titulo: 'Tipo', ver: (e) => rotulo(TIPOS, e.tipo) }, { titulo: 'Marca e modelo', ver: (e) => `${e.marca || ''} ${e.modelo || ''}`.trim() || '-' },
            { titulo: 'Ano', num: true, ver: (e) => e.anoFabricacao }, { titulo: 'Estado', ver: (e) => rotulo(ESTADOS, e.estadoFisico) }, { titulo: 'Situação', ver: (e) => <SeloStatus status={e.statusRastreamento} /> }]} />
          {modal === 'adicionar' && <AdicionarEquipamentos id={id} versao={l.versao} aoFechar={fechar} aoConcluir={recarregar} />}
          {modal === 'corrigir' && (
            <FormModal titulo="Corrigir lote" aoFechar={fechar} aoEnviar={(v) => agir(I(`/lotes/${id}`), 'PUT', { ...v, versao: l.versao }, 'Lote corrigido')}
              campos={[
                { n: 'notaFiscal', rot: 'Nota fiscal', valor: l.notaFiscal, req: true, max: 60 }, { n: 'transportadora', rot: 'Transportadora', valor: l.transportadora, req: true, max: 120 },
                ...(recebido ? [{ n: 'dataEntrada', rot: 'Data de entrada', tipo: 'date', valor: dia(l.dataEntrada), dica: 'Só pode mudar antes da triagem.' }] : []),
                { n: 'observacoes', rot: 'Observações', linhas: 3, valor: l.observacoes, max: 2000 }]} />
          )}
        </>
      )}
    </div>
  );
}

// Oliver passou por aqui.
