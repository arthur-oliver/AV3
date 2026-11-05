import { useState } from 'react';
import { I, avisar, chamar, seguro } from '../../lib/api.js';
import { ir, useCarregar } from '../../lib/hooks.js';
import { podeAlmox } from '../../lib/papeis.js';
import { ESTADOS, STATUS, TIPOS, curto, data, num, qs, rotulo } from '../../lib/rotulos.js';
import { Acoes, Botao, Cabeca, Campo, Carregando, FormModal, H2, H3, Indicadores, LinhaCampos, ListaPaginada, SeloStatus, Seletor, Tabela, Vazio, Voltar } from '../../components/ui.jsx';

export default function Equipamentos({ id }) {
  return id ? <Equipamento id={id} /> : <Lista />;
}

function Lista() {
  const [status, setStatus] = useState('');
  const [tipo, setTipo] = useState('');
  return (
    <div>
      <Cabeca titulo="Equipamentos" texto="Todos os equipamentos recebidos. Abra um para ver o histórico e movimentá-lo." />
      <LinhaCampos>
        <Campo rotulo="Situação">{(i) => <Seletor id={i} opcoes={STATUS} vazio="Todos" value={status} onChange={(e) => setStatus(e.target.value)} />}</Campo>
        <Campo rotulo="Tipo">{(i) => <Seletor id={i} opcoes={TIPOS} vazio="Todos" value={tipo} onChange={(e) => setTipo(e.target.value)} />}</Campo>
      </LinhaCampos>
      <ListaPaginada deps={[status, tipo]} vazio="Nenhum equipamento encontrado." aoClicar={(e) => ir(`equipamentos/${e.id}`)}
        buscar={(pagina, limite) => chamar(I(`/equipamentos?${qs({ pagina, limite, status, tipo })}`))}
        colunas={[
          { titulo: 'Código', ver: (e) => curto(e.id) }, { titulo: 'Tipo', ver: (e) => rotulo(TIPOS, e.tipo) }, { titulo: 'Marca e modelo', ver: (e) => `${e.marca || ''} ${e.modelo || ''}`.trim() || '-' },
          { titulo: 'Estado', ver: (e) => rotulo(ESTADOS, e.estadoFisico) }, { titulo: 'Peso (kg)', num: true, ver: (e) => num(e.pesoQuilogramas) }, { titulo: 'Situação', ver: (e) => <SeloStatus status={e.statusRastreamento} /> }]} />
    </div>
  );
}

function Equipamento({ id }) {
  const a = useCarregar(() => chamar(I(`/equipamentos/${id}`)), [id]);
  const b = useCarregar(() => chamar(I(`/equipamentos/${id}/rastreamento`)), [id]);
  const [modal, setModal] = useState(null);
  const pode = podeAlmox();
  const e = a.dados;
  const mov = b.dados ? b.dados.movimentacoes : [];
  const fechar = () => setModal(null);
  const refazer = () => { a.recarregar(); b.recarregar(); };

  async function agir(caminho, metodo, corpo, msg) {
    const r = await seguro(() => chamar(caminho, { metodo, corpo }));
    if (!r) return false;
    if (msg) avisar(msg);
    refazer();
    return true;
  }
  const prox = e ? Object.fromEntries((e.proximosStatusPermitidos || []).map((s) => [s, rotulo(STATUS, s)])) : {};

  return (
    <div>
      <Voltar para="equipamentos">Voltar para os equipamentos</Voltar>
      <Cabeca titulo="Detalhe do equipamento" />
      {(a.carregando && !e) ? <Carregando /> : !e ? <Vazio>Não foi possível abrir este equipamento.</Vazio> : (
        <>
          <H2 className="mt-0">{`${rotulo(TIPOS, e.tipo)} ${e.marca || ''} ${e.modelo || ''}`.trim()}</H2>
          <Indicadores itens={[['Código de barras', e.codigoBarrasInterno || e.id], ['Situação', rotulo(STATUS, e.statusRastreamento)], ['Estado físico', rotulo(ESTADOS, e.estadoFisico)], ['Peso', `${num(e.pesoQuilogramas)} kg`], ['Ano de fabricação', e.anoFabricacao], ['Lote', e.lote ? e.lote.notaFiscal : '-']]} />
          {e.lote && <p><a className="text-acao underline" href={`#/lotes/${e.loteId}`}>Abrir o lote</a></p>}
          {pode && (
            <Acoes>
              {Object.keys(prox).length > 0 && <Botao onClick={() => setModal('status')}>Mudar situação</Botao>}
              <Botao variante="sec" onClick={() => setModal('mov')}>Registrar movimentação</Botao>
              <Botao variante="sec" onClick={() => setModal('estado')}>Estado físico</Botao>
              <Botao variante="sec" onClick={() => setModal('corrigir')}>Corrigir dados</Botao>
              <Botao variante="perigo" onClick={async () => { if (!window.confirm('Excluir DEFINITIVAMENTE o equipamento e o histórico dele?')) return; const r = await seguro(() => chamar(I(`/equipamentos/${id}?versao=${e.versao}`), { metodo: 'DELETE' })); if (r) { avisar('Equipamento excluído'); ir('equipamentos'); } }}>Excluir</Botao>
            </Acoes>
          )}
          <H3>Histórico</H3>
          <Tabela vazio="Sem movimentações." linhas={mov} colunas={[
            { titulo: 'Quando', ver: (x) => data(x.dataHora) }, { titulo: 'De', ver: (x) => rotulo(STATUS, x.origem) }, { titulo: 'Para', ver: (x) => rotulo(STATUS, x.destino) },
            { titulo: 'Responsável', ver: (x) => x.responsavel }, { titulo: 'Observação', ver: (x) => x.observacao || '-' }]} />
          {modal === 'status' && <FormModal titulo="Mudar situação" aoFechar={fechar} aoEnviar={(v) => agir(I(`/equipamentos/${id}/status`), 'PATCH', { ...v, versao: e.versao }, 'Situação alterada')} campos={[{ n: 'status', rot: 'Nova situação', op: prox, valor: Object.keys(prox)[0] }, { n: 'justificativa', rot: 'Justificativa', linhas: 2, req: true, max: 1000, dica: 'Fica registrada no histórico.' }]} />}
          {modal === 'mov' && <FormModal titulo="Registrar movimentação" aoFechar={fechar} aoEnviar={(v) => agir(I(`/equipamentos/${id}/movimentacoes`), 'POST', v, 'Movimentação registrada')} campos={[{ n: 'destino', rot: 'Destino', req: true, max: 120, dica: 'Ex.: Prateleira B2, Bancada de desmonte.' }, { n: 'observacao', rot: 'Observação', max: 1000 }]} />}
          {modal === 'estado' && <FormModal titulo="Alterar estado físico" aoFechar={fechar} aoEnviar={(v) => agir(I(`/equipamentos/${id}/estado-fisico`), 'PATCH', { ...v, versao: e.versao }, 'Estado alterado')} campos={[{ n: 'estadoFisico', rot: 'Novo estado', op: ESTADOS, valor: e.estadoFisico }, { n: 'justificativa', rot: 'Justificativa', linhas: 2, max: 1000, dica: 'Obrigatória se o estado piorar duas categorias ou mais.' }]} />}
          {modal === 'corrigir' && <FormModal titulo="Corrigir equipamento" aoFechar={fechar} aoEnviar={(v) => agir(I(`/equipamentos/${id}`), 'PUT', { ...v, versao: e.versao }, 'Dados corrigidos')} campos={[{ n: 'tipo', rot: 'Tipo', op: TIPOS, valor: e.tipo }, { n: 'marca', rot: 'Marca', valor: e.marca, max: 80 }, { n: 'modelo', rot: 'Modelo', valor: e.modelo, max: 80 }, { n: 'anoFabricacao', rot: 'Ano', tipo: 'number', min: 1970, max: 2100, valor: e.anoFabricacao, req: true }, { n: 'pesoQuilogramas', rot: 'Peso (kg)', tipo: 'number', step: '0.001', min: 0.001, valor: Number(e.pesoQuilogramas), req: true }]} />}
        </>
      )}
    </div>
  );
}

// Arthur Oliver Rossi Alves, autor do Greencode.
