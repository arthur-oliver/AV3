import { useState } from 'react';
import { I, avisar, chamar, seguro } from '../../lib/api.js';
import { ir, useCarregar } from '../../lib/hooks.js';
import { podeCadastro } from '../../lib/papeis.js';
import { data, dia, qs, reais, sn } from '../../lib/rotulos.js';
import { Acoes, Botao, Cabeca, Campo, Carregando, Entrada, FormModal, H2, Indicadores, LinhaCampos, ListaPaginada, Selo, Seletor, Vazio, Voltar } from '../../components/ui.jsx';

const camposOrg = (o, novo) => [
  { n: 'razaoSocial', rot: 'Razão social', valor: o.razaoSocial, req: true, min: 2, max: 200 },
  ...(novo ? [{ n: 'cnpj', rot: 'CNPJ', req: true, max: 20, dica: 'O sistema valida os dígitos verificadores.' }] : []),
  { n: 'inscricaoEstadual', rot: 'Inscrição estadual', valor: o.inscricaoEstadual, max: 30 },
  { n: 'enderecoCompleto', rot: 'Endereço', valor: o.enderecoCompleto, max: 1000 },
  { n: 'telefone', rot: 'Telefone', valor: o.telefone, max: 30 },
  { n: 'email', rot: 'E-mail', tipo: 'email', valor: o.email, max: 150 }
];
const camposContrato = (c) => [
  { n: 'dataVencimento', rot: 'Vencimento', tipo: 'date', valor: dia(c && c.dataVencimento), req: true },
  { n: 'valorMensal', rot: 'Valor mensal (R$)', tipo: 'number', step: '0.01', min: 0, valor: c ? Number(c.valorMensal) : '', req: true },
  { n: 'clausulas', rot: 'Cláusulas', linhas: 4, valor: c && Array.isArray(c.clausulas) ? c.clausulas.join('\n') : '', dica: 'Uma por linha.' },
  { n: 'renovacaoAutomatica', rot: 'Renovação automática', tipo: 'check', valor: c && c.renovacaoAutomatica }
];
const corpoContrato = (v) => ({ dataVencimento: v.dataVencimento, valorMensal: v.valorMensal, clausulas: (v.clausulas || '').split('\n').map((x) => x.trim()).filter(Boolean), renovacaoAutomatica: !!v.renovacaoAutomatica });

export default function Organizacoes({ id }) {
  return id ? <Organizacao id={id} /> : <Lista />;
}

function Lista() {
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [ativo, setAtivo] = useState('');
  const [novo, setNovo] = useState(false);
  return (
    <div>
      <Cabeca titulo="Organizações" texto="Empresas que enviam equipamentos, com o contrato de cada uma." />
      {podeCadastro() && <Acoes className="mb-3"><Botao onClick={() => setNovo(true)}>Nova organização</Botao></Acoes>}
      <LinhaCampos>
        <Campo rotulo="Buscar">{(i) => <Entrada id={i} placeholder="Razão social ou CNPJ" value={busca} onChange={(e) => { setBusca(e.target.value); clearTimeout(Lista.t); Lista.t = setTimeout(() => setBuscaAplicada(e.target.value.trim()), 350); }} />}</Campo>
        <Campo rotulo="Situação">{(i) => <Seletor id={i} opcoes={{ true: 'Ativas', false: 'Inativas' }} vazio="Todas" value={ativo} onChange={(e) => setAtivo(e.target.value)} />}</Campo>
      </LinhaCampos>
      <ListaPaginada deps={[buscaAplicada, ativo]} vazio="Nenhuma organização encontrada." aoClicar={(o) => ir(`organizacoes/${o.id}`)}
        buscar={(pagina, limite) => chamar(I(`/organizacoes?${qs({ pagina, limite, busca: buscaAplicada, ativo })}`))}
        colunas={[
          { titulo: 'Razão social', ver: (o) => o.razaoSocial }, { titulo: 'CNPJ', ver: (o) => o.cnpj },
          { titulo: 'Contrato', ver: (o) => (o.contrato ? <Selo tipo={o.contratoVigente ? 'ok' : 'erro'}>{o.contratoVigente ? 'Vigente' : 'Vencido'}</Selo> : <Selo>Sem contrato</Selo>) },
          { titulo: 'Situação', ver: (o) => <Selo tipo={o.ativo ? 'ok' : 'erro'}>{o.ativo ? 'Ativa' : 'Inativa'}</Selo> }]} />
      {novo && (
        <FormModal titulo="Nova organização" botao="Cadastrar" aoFechar={() => setNovo(false)} campos={camposOrg({}, true)}
          aoEnviar={async (v) => {
            const r = await seguro(() => chamar(I('/organizacoes'), { metodo: 'POST', corpo: v }));
            if (!r) return false;
            avisar('Organização cadastrada');
            ir(`organizacoes/${r.dados.id}`);
            return true;
          }} />
      )}
    </div>
  );
}

function Organizacao({ id }) {
  const { dados: o, carregando, recarregar } = useCarregar(() => chamar(I(`/organizacoes/${id}`)), [id]);
  const [modal, setModal] = useState(null);
  const pode = podeCadastro();
  const c = o && o.contrato;
  const fechar = () => setModal(null);

  async function agir(caminho, metodo, corpo, msg) {
    const r = await seguro(() => chamar(caminho, { metodo, corpo }));
    if (!r) return false;
    if (msg) avisar(msg);
    recarregar();
    return true;
  }
  async function remover(caminho, confirmacao, msg, depois) {
    if (!window.confirm(confirmacao)) return;
    const r = await seguro(() => chamar(caminho, { metodo: 'DELETE' }));
    if (r) { avisar(msg); depois(); }
  }

  return (
    <div>
      <Voltar para="organizacoes">Voltar para as organizações</Voltar>
      <Cabeca titulo={o ? o.razaoSocial : 'Organização'} />
      {carregando && !o ? <Carregando /> : !o ? <Vazio>Não foi possível abrir esta organização.</Vazio> : (
        <>
          <Indicadores itens={[['CNPJ', o.cnpj], ['Situação', o.ativo ? 'Ativa' : 'Inativa'], ['Inscrição estadual', o.inscricaoEstadual || '-'], ['Telefone', o.telefone || '-'], ['E-mail', o.email || '-']]} />
          {o.enderecoCompleto && <p>{o.enderecoCompleto}</p>}
          {pode && (
            <Acoes>
              <Botao onClick={() => setModal('editar')}>Editar dados</Botao>
              <Botao variante="sec" onClick={() => { if (!o.ativo || window.confirm('Inativar a organização? Os lotes e equipamentos dela também ficam inativos (podem ser reativados).')) agir(I(`/organizacoes/${id}/ativo`), 'PATCH', { ativo: !o.ativo, versao: o.versao }, o.ativo ? 'Organização inativada' : 'Organização reativada'); }}>{o.ativo ? 'Inativar' : 'Reativar'}</Botao>
              <Botao variante="perigo" onClick={() => remover(I(`/organizacoes/${id}?versao=${o.versao}`), 'Excluir DEFINITIVAMENTE a organização, o contrato, os lotes, os equipamentos e as movimentações? Não dá para desfazer.', 'Organização excluída', () => ir('organizacoes'))}>Excluir de vez</Botao>
            </Acoes>
          )}
          <H2>Contrato</H2>
          {c ? (
            <>
              <Indicadores itens={[['Situação', o.contratoVigente ? 'Vigente' : 'Vencido'], ['Assinatura', data(c.dataAssinatura).slice(0, 10)], ['Vencimento', data(c.dataVencimento).slice(0, 10)], ['Valor mensal', reais(c.valorMensal)], ['Renovação automática', sn(c.renovacaoAutomatica)]]} />
              <ul className="mb-3 ml-5 list-disc">{(Array.isArray(c.clausulas) ? c.clausulas : []).map((x, i) => <li key={i}>{x}</li>)}</ul>
              {pode && (
                <Acoes>
                  <Botao onClick={() => setModal('renovar')}>Renovar</Botao>
                  <Botao variante="sec" onClick={() => setModal('substituir')}>Substituir</Botao>
                  <Botao variante="perigo" onClick={() => remover(I(`/organizacoes/${id}/contrato?versao=${c.versao}`), 'Remover o contrato? Sem contrato a organização não recebe novos lotes.', 'Contrato removido', recarregar)}>Remover</Botao>
                </Acoes>
              )}
            </>
          ) : (
            <>
              <Vazio>Esta organização não tem contrato e, por isso, não recebe novos lotes.</Vazio>
              {pode && <Acoes><Botao onClick={() => setModal('novoContrato')}>Cadastrar contrato</Botao></Acoes>}
            </>
          )}
          {modal === 'editar' && <FormModal titulo="Editar organização" aoFechar={fechar} campos={camposOrg(o, false)} aoEnviar={(v) => agir(I(`/organizacoes/${id}`), 'PUT', { ...v, versao: o.versao }, 'Dados salvos')} />}
          {modal === 'renovar' && <FormModal titulo="Renovar contrato" aoFechar={fechar} campos={[{ n: 'novoVencimento', rot: 'Novo vencimento', tipo: 'date', req: true, dica: 'Precisa ser depois do vencimento atual.' }]} aoEnviar={(v) => agir(I(`/organizacoes/${id}/contrato/renovar`), 'PATCH', { novoVencimento: v.novoVencimento, versao: c.versao }, 'Contrato renovado')} />}
          {modal === 'substituir' && <FormModal titulo="Substituir contrato" aoFechar={fechar} campos={camposContrato(c)} aoEnviar={(v) => agir(I(`/organizacoes/${id}/contrato`), 'PUT', { ...corpoContrato(v), versao: c.versao }, 'Contrato substituído')} />}
          {modal === 'novoContrato' && <FormModal titulo="Novo contrato" botao="Cadastrar" aoFechar={fechar} campos={camposContrato(null)} aoEnviar={(v) => agir(I(`/organizacoes/${id}/contrato`), 'PUT', corpoContrato(v), 'Contrato cadastrado')} />}
        </>
      )}
    </div>
  );
}

// Alves aprova este código.
