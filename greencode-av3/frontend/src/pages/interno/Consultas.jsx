// Relatórios de consulta imediata e auditoria (equipe interna).
import { useState } from 'react';
import { I, baixar, chamar, seguro } from '../../lib/api.js';
import { ir, useCarregar } from '../../lib/hooks.js';
import { LOTES, STATUS, TIPOS, curto, data, num, qs, reais, rotulo, sn } from '../../lib/rotulos.js';
import { Acoes, Botao, Cabeca, Campo, Entrada, H2, H3, Indicadores, LinhaCampos, Painel, Seletor, Suave, Tabela } from '../../components/ui.jsx';

export function RelatoriosConsulta() {
  const orgs = useCarregar(() => chamar(I('/organizacoes?limite=200')), []);
  const [f, setF] = useState({ tipo: 'org', org: '', st: 'AGUARDANDO_TRIAGEM', ini: '', fim: '', inat: false });
  const [saida, setSaida] = useState(null); // { tipo, d }
  const campo = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const opcoesOrg = Object.fromEntries((orgs.dados || []).map((o) => [o.id, o.razaoSocial]));
  const orgEscolhida = f.org || (orgs.dados && orgs.dados[0] ? orgs.dados[0].id : '');

  const url = (csv) => {
    const inc = f.inat ? 'true' : '';
    const formato = csv ? 'csv' : '';
    if (f.tipo === 'org') return I(`/relatorios/organizacao/${orgEscolhida}?${qs({ inicio: f.ini, fim: f.fim, incluirInativos: inc, formato })}`);
    if (f.tipo === 'status') return I(`/relatorios/status/${f.st}?${qs({ incluirInativos: inc, formato })}`);
    return I(`/relatorios/financeiro?${qs({ inicio: f.ini, fim: f.fim, formato })}`);
  };
  async function gerar(ev) {
    ev.preventDefault();
    const r = await seguro(() => chamar(url(false)));
    if (r) setSaida({ tipo: f.tipo, d: r.dados });
  }
  const d = saida && saida.d;
  return (
    <div>
      <Cabeca titulo="Relatórios" texto={'Consultas imediatas, com opção de baixar em CSV. Para análises pesadas, use "Pedidos de relatório".'} />
      <Painel>
        <form onSubmit={gerar}>
          <LinhaCampos>
            <Campo rotulo="Relatório">{(i) => <Seletor id={i} opcoes={{ org: 'Por organização', status: 'Por situação do equipamento', fin: 'Financeiro (contratos)' }} value={f.tipo} onChange={(e) => { campo('tipo')(e); setSaida(null); }} />}</Campo>
            {f.tipo === 'org' && <Campo rotulo="Organização">{(i) => <Seletor id={i} required opcoes={opcoesOrg} value={orgEscolhida} onChange={campo('org')} />}</Campo>}
            {f.tipo === 'status' && <Campo rotulo="Situação">{(i) => <Seletor id={i} opcoes={STATUS} value={f.st} onChange={campo('st')} />}</Campo>}
            {f.tipo !== 'status' && <Campo rotulo="De">{(i) => <Entrada id={i} type="date" value={f.ini} onChange={campo('ini')} />}</Campo>}
            {f.tipo !== 'status' && <Campo rotulo="Até">{(i) => <Entrada id={i} type="date" value={f.fim} onChange={campo('fim')} />}</Campo>}
            {f.tipo !== 'fin' && (
              <Campo rotulo="Incluir inativos">{(i) => <input id={i} type="checkbox" className="h-4 w-4" checked={f.inat} onChange={(e) => setF((x) => ({ ...x, inat: e.target.checked }))} />}</Campo>
            )}
          </LinhaCampos>
          <Acoes><Botao type="submit">Gerar</Botao></Acoes>
        </form>
      </Painel>
      {d && saida.tipo === 'org' && (
        <div>
          <H2>{d.organizacao.razaoSocial}</H2>
          <Indicadores itens={[['Lotes', d.totalLotes], ['Equipamentos', d.totalEquipamentos], ['Peso total', `${num(d.pesoTotalKg)} kg`]]} />
          <H3>Equipamentos por situação</H3>
          <Tabela vazio="Sem equipamentos no período." linhas={Object.entries(d.equipamentosPorStatus)} colunas={[{ titulo: 'Situação', ver: (x) => rotulo(STATUS, x[0]) }, { titulo: 'Quantidade', num: true, ver: (x) => x[1] }]} />
          <H3>Lotes</H3>
          <Tabela vazio="Sem lotes no período." linhas={d.lotes} colunas={[{ titulo: 'Nota fiscal', ver: (l) => l.notaFiscal }, { titulo: 'Entrada', ver: (l) => data(l.dataEntrada) }, { titulo: 'Situação', ver: (l) => rotulo(LOTES, l.statusProcessamento) }, { titulo: 'Equipamentos', num: true, ver: (l) => l.equipamentos }]} />
        </div>
      )}
      {d && saida.tipo === 'status' && (
        <div>
          <H2>{rotulo(STATUS, d.status)}</H2>
          <Indicadores itens={[['Equipamentos', d.total]]} />
          <Tabela vazio="Nenhum equipamento nesta situação." linhas={d.equipamentos} aoClicar={(e) => ir(`equipamentos/${e.id}`)} colunas={[{ titulo: 'Código', ver: (e) => curto(e.id) }, { titulo: 'Tipo', ver: (e) => rotulo(TIPOS, e.tipo) }, { titulo: 'Marca e modelo', ver: (e) => `${e.marca || ''} ${e.modelo || ''}`.trim() || '-' }, { titulo: 'Lote', ver: (e) => (e.lote ? e.lote.notaFiscal : '-') }]} />
        </div>
      )}
      {d && saida.tipo === 'fin' && (
        <div>
          <H2>Contratos no período</H2>
          <Indicadores itens={[['Organizações com contrato', d.organizacoesComContrato], ['Valor mensal contratado', reais(d.valorMensalContratado)]]} />
          <Tabela vazio="Nenhum contrato vigente no período." linhas={d.contratos} colunas={[{ titulo: 'Organização', ver: (c) => c.organizacao.razaoSocial }, { titulo: 'Valor mensal', num: true, ver: (c) => reais(c.valorMensal) }, { titulo: 'Vencimento', ver: (c) => data(c.dataVencimento).slice(0, 10) }, { titulo: 'Renovação automática', ver: (c) => sn(c.renovacaoAutomatica) }]} />
        </div>
      )}
      {d && <Acoes><Botao variante="sec" onClick={() => baixar(url(true), 'relatorio.csv')}>Baixar CSV (abre no Excel)</Botao></Acoes>}
    </div>
  );
}

const ENTIDADES = ['Usuario', 'Organizacao', 'Contrato', 'Lote', 'Equipamento'];
const json = (x) => (x === null || x === undefined ? '-' : JSON.stringify(x, null, 2));

export function Auditoria() {
  const [f, setF] = useState({ ent: '', usu: '', ini: '', fim: '', lim: '50' });
  const [filtro, setFiltro] = useState(f);
  const campo = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const url = (c, csv) => I(`/auditoria?${qs({ entidade: c.ent.trim(), usuario: c.usu.trim(), inicio: c.ini, fim: c.fim, limite: c.lim, formato: csv ? 'csv' : '' })}`);
  const r = useCarregar(() => chamar(url(filtro, false)), [filtro]);
  const d = r.dados;
  return (
    <div>
      <Cabeca titulo="Auditoria" texto="Registro de quem fez o quê, com o estado antes e depois de cada operação." />
      <Painel>
        <form onSubmit={(ev) => { ev.preventDefault(); setFiltro({ ...f }); }}>
          <LinhaCampos>
            <Campo rotulo="Entidade">{(i) => <Seletor id={i} opcoes={Object.fromEntries(ENTIDADES.map((x) => [x, x]))} vazio="Todas" value={f.ent} onChange={campo('ent')} />}</Campo>
            <Campo rotulo="Usuário">{(i) => <Entrada id={i} placeholder="Login" value={f.usu} onChange={campo('usu')} />}</Campo>
            <Campo rotulo="De">{(i) => <Entrada id={i} type="date" value={f.ini} onChange={campo('ini')} />}</Campo>
            <Campo rotulo="Até">{(i) => <Entrada id={i} type="date" value={f.fim} onChange={campo('fim')} />}</Campo>
            <Campo rotulo="Quantidade">{(i) => <Seletor id={i} opcoes={{ 50: '50', 100: '100', 250: '250', 500: '500' }} value={f.lim} onChange={campo('lim')} />}</Campo>
          </LinhaCampos>
          <Acoes><Botao type="submit">Filtrar</Botao></Acoes>
        </form>
      </Painel>
      {d && (
        <div>
          <Suave className="mb-2">{d.total} registro(s), do mais recente ao mais antigo. Abra "Ver" para o antes e o depois.</Suave>
          <Tabela vazio="Nenhum registro com esses filtros." linhas={d.registros} colunas={[
            { titulo: 'Quando', ver: (x) => data(x.timestamp) }, { titulo: 'Operação', ver: (x) => x.operacao }, { titulo: 'Entidade', ver: (x) => `${x.entidade} ${curto(x.entidadeId)}` }, { titulo: 'Usuário', ver: (x) => x.usuarioResponsavel },
            { titulo: '', ver: (x) => (
              <details>
                <summary className="cursor-pointer text-acao">Ver</summary>
                <pre className="mt-1 max-h-72 overflow-auto rounded bg-papel p-2 text-[0.8rem]">{`Antes:\n${json(x.dadosAntes)}\n\nDepois:\n${json(x.dadosDepois)}`}</pre>
              </details>) }]} />
          <Acoes><Botao variante="sec" onClick={() => baixar(url(filtro, true), 'auditoria.csv')}>Baixar CSV</Botao></Acoes>
        </div>
      )}
    </div>
  );
}

// Oliver passou por aqui.
