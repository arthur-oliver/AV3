import { useEffect, useState } from 'react';
import { P, avisar, chamar, obterSessao, seguro } from '../lib/api.js';
import { ir, useCarregar } from '../lib/hooks.js';
import { ESTADOS, LOTES, PERMISSOES, STATUS, TIPOS, data, num, rotulo } from '../lib/rotulos.js';
import { Acoes, Botao, Cabeca, Campo, Carregando, ETAPAS, Entrada, H2, H3, Indicadores, ListaPaginada, Painel, Selo, SeloStatus, Seletor, Suave, Tabela, Trilha, Vazio, Voltar, AreaTexto, LinhaCampos } from '../components/ui.jsx';
import { LinhasEquip, useLinhasEquip } from '../components/LinhasEquip.jsx';

export function InicioParceiro() {
  const s = obterSessao();
  return (
    <div>
      <Cabeca titulo="Seu painel" texto="Acompanhe os equipamentos enviados, registre novos lotes e consulte as análises da sua organização." />
      <Painel>
        <h3 className="mb-1 w-fit border-b-2 border-acao font-mono text-[0.9rem] font-semibold uppercase tracking-[0.1em]">{s.nome}</h3>
        <Suave>Organização {s.organizacaoId}</Suave>
        <H3>O que esta chave permite</H3>
        <ul className="ml-5 list-disc">
          {Object.entries(PERMISSOES).map(([k, v]) => {
            const tem = s.permissoes.includes(k);
            return <li key={k} className={tem ? '' : 'opacity-50'}>{v}{tem ? '' : ' (não liberado)'}</li>;
          })}
        </ul>
      </Painel>
      <Suave className="mt-4">Cada chave tem um limite de requisições por minuto, mostrado no cabeçalho. Ao atingir o limite, aguarde alguns segundos.</Suave>
    </div>
  );
}

export function LotesParceiro({ id }) {
  return id ? <LoteDetalhe id={id} /> : <ListaLotes />;
}

function ListaLotes() {
  const [status, setStatus] = useState('');
  return (
    <div>
      <Cabeca titulo="Lotes" texto="Abra um lote para ver os equipamentos e acompanhar cada um." />
      <Campo rotulo="Filtrar por situação" className="max-w-[260px]">{(i) => <Seletor id={i} opcoes={LOTES} vazio="Todos os status" value={status} onChange={(e) => setStatus(e.target.value)} />}</Campo>
      <ListaPaginada deps={[status]} vazio="Nenhum lote encontrado." aoClicar={(l) => ir(`lotes/${l.id}`)}
        buscar={(pagina, limite) => chamar(P(`/lotes?${new URLSearchParams({ pagina, limite, ...(status ? { status } : {}) })}`))}
        colunas={[
          { titulo: 'Nota fiscal', ver: (l) => l.notaFiscal }, { titulo: 'Entrada', ver: (l) => data(l.dataEntrada) }, { titulo: 'Transportadora', ver: (l) => l.transportadora },
          { titulo: 'Equipamentos', num: true, ver: (l) => (l._count ? l._count.equipamentos : '-') }, { titulo: 'Situação', ver: (l) => <Selo>{rotulo(LOTES, l.statusProcessamento)}</Selo> }]} />
    </div>
  );
}

function LoteDetalhe({ id }) {
  const { dados, carregando } = useCarregar(() => chamar(P(`/lotes/${id}`)), [id]);
  return (
    <div>
      <Voltar para="lotes">Voltar para os lotes</Voltar>
      <Cabeca titulo="Detalhe do lote" />
      {carregando ? <Carregando /> : !dados ? <Vazio>Não foi possível abrir este lote.</Vazio> : (
        <>
          <Indicadores itens={[['Nota fiscal', dados.notaFiscal], ['Entrada', data(dados.dataEntrada)], ['Transportadora', dados.transportadora], ['Situação', rotulo(LOTES, dados.statusProcessamento)], ['Equipamentos', dados.resumo.quantidade], ['Peso total', `${num(dados.resumo.pesoTotalKg)} kg`]]} />
          {dados.observacoes && <p>{dados.observacoes}</p>}
          <H2>Equipamentos</H2>
          <Tabela vazio="Este lote ainda não tem equipamentos." linhas={dados.equipamentos} aoClicar={(e) => ir(`rastrear/${e.id}`)} colunas={[
            { titulo: '#', num: true, ver: (e) => e.posicaoNoLote }, { titulo: 'Tipo', ver: (e) => rotulo(TIPOS, e.tipo) }, { titulo: 'Marca e modelo', ver: (e) => `${e.marca} ${e.modelo}`.trim() || '-' },
            { titulo: 'Ano', num: true, ver: (e) => e.anoFabricacao }, { titulo: 'Estado', ver: (e) => rotulo(ESTADOS, e.estadoFisico) }, { titulo: 'Situação', ver: (e) => <SeloStatus status={e.statusRastreamento} /> }]} />
        </>
      )}
    </div>
  );
}

export function Rastrear({ id }) {
  const [codigo, setCodigo] = useState(id || '');
  const [buscado, setBuscado] = useState(id || '');
  useEffect(() => { if (id) { setCodigo(id); setBuscado(id); } }, [id]);
  const { dados, carregando } = useCarregar(() => (buscado ? chamar(P(`/rastreabilidade/${encodeURIComponent(buscado.trim())}`)) : Promise.resolve(null)), [buscado]);
  const e = dados && dados.equipamento;
  const mov = dados ? dados.movimentacoes : [];
  const visitados = new Set(mov.map((x) => x.destino));
  if (e) visitados.add(e.statusRastreamento);
  return (
    <div>
      <Cabeca titulo="Rastrear equipamento" texto="Veja por onde o equipamento passou e em que etapa ele está." />
      <Painel>
        <form onSubmit={(ev) => { ev.preventDefault(); if (codigo.trim()) setBuscado(codigo); }}>
          <Campo rotulo="Código do equipamento">{(i) => <Entrada id={i} placeholder="Código do equipamento (36 caracteres)" value={codigo} onChange={(ev) => setCodigo(ev.target.value)} />}</Campo>
          <Acoes><Botao type="submit">Rastrear</Botao></Acoes>
        </form>
      </Painel>
      <section className="mt-4">
        {carregando ? <Carregando /> : buscado && !e ? <Vazio>Confira o código. Ele fica na etiqueta do equipamento e no detalhe do lote.</Vazio> : e && (
          <>
            <H2 className="mt-0">{`${rotulo(TIPOS, e.tipo)} ${e.marca} ${e.modelo}`.trim()}</H2>
            <Suave>Código {e.codigoBarrasInterno}. {rotulo(ESTADOS, e.estadoFisico)}, {num(e.pesoQuilogramas)} kg, fabricado em {e.anoFabricacao}.</Suave>
            <Trilha visitados={visitados} atual={e.statusRastreamento} />
            <p>Situação atual: <Selo tipo={e.statusRastreamento === 'BAIXA_DEFINITIVA' ? 'ok' : 'andamento'}>{rotulo(STATUS, e.statusRastreamento)}</Selo></p>
            <H3>Histórico</H3>
            <Tabela linhas={mov} colunas={[
              { titulo: 'Quando', ver: (x) => data(x.dataHora) }, { titulo: 'De', ver: (x) => rotulo(STATUS, x.origem) }, { titulo: 'Para', ver: (x) => rotulo(STATUS, x.destino) },
              { titulo: 'Responsável', ver: (x) => x.responsavel }, { titulo: 'Observação', ver: (x) => x.observacao || '-' }]} />
          </>
        )}
      </section>
    </div>
  );
}

export function NovoLoteParceiro() {
  const eq = useLinhasEquip();
  const [f, setF] = useState({ nf: '', tr: '', de: '', ob: '' });
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const campo = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function enviar(ev) {
    ev.preventDefault();
    const corpo = { notaFiscal: f.nf, transportadora: f.tr, observacoes: f.ob, equipamentos: eq.valores() };
    if (f.de) corpo.dataEntrada = f.de;
    setEnviando(true);
    const r = await seguro(() => chamar(P('/lotes'), { metodo: 'POST', corpo }));
    setEnviando(false);
    if (!r) return;
    avisar('Lote registrado', `Nota fiscal ${r.dados.notaFiscal}.`);
    setResultado(r.dados);
    setF({ nf: '', tr: '', de: '', ob: '' });
    eq.reiniciar();
  }
  return (
    <div>
      <Cabeca titulo="Registrar lote" texto="Informe os dados da nota fiscal e liste os equipamentos enviados. O lote entra na sua organização." />
      <Painel>
        <form onSubmit={enviar}>
          <LinhaCampos>
            <Campo rotulo="Nota fiscal">{(i) => <Entrada id={i} required maxLength={60} value={f.nf} onChange={campo('nf')} />}</Campo>
            <Campo rotulo="Transportadora">{(i) => <Entrada id={i} required maxLength={120} value={f.tr} onChange={campo('tr')} />}</Campo>
            <Campo rotulo="Data de entrada (opcional)">{(i) => <Entrada id={i} type="date" value={f.de} onChange={campo('de')} />}</Campo>
          </LinhaCampos>
          <Campo rotulo="Observações">{(i) => <AreaTexto id={i} rows={2} maxLength={2000} value={f.ob} onChange={campo('ob')} />}</Campo>
          <H3 className="mt-2">Equipamentos</H3>
          <LinhasEquip estado={eq} />
          <Acoes className="mt-4"><Botao variante="sec" onClick={eq.adicionar}>Adicionar equipamento</Botao><Botao type="submit" disabled={enviando}>Registrar lote</Botao></Acoes>
        </form>
      </Painel>
      {resultado && (
        <Painel>
          <h3 className="mb-1 w-fit border-b-2 border-acao font-mono text-[0.9rem] font-semibold uppercase tracking-[0.1em]">Lote registrado</h3>
          <p>Foram cadastrados {resultado.equipamentos.length} equipamento(s). Guarde os códigos para rastrear:</p>
          <Tabela linhas={resultado.equipamentos} colunas={[{ titulo: 'Tipo', ver: (e) => rotulo(TIPOS, e.tipo) }, { titulo: 'Código', ver: (e) => e.codigoBarrasInterno }]} />
          <p className="mt-3"><a className="text-acao underline" href={`#/lotes/${resultado.id}`}>Abrir o lote</a></p>
        </Painel>
      )}
    </div>
  );
}

// Alves aprova este código.
