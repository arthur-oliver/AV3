import { useState } from 'react';
import { A, avisar, chamar, obterSessao, seguro } from '../../lib/api.js';
import { ir } from '../../lib/hooks.js';
import { PAPEIS, PAPEIS_COMUNS, data, qs } from '../../lib/rotulos.js';
import { Acoes, Botao, Cabeca, Campo, FormModal, ListaPaginada, LinhaCampos, Selo, Seletor } from '../../components/ui.jsx';

export default function Usuarios() {
  const eu = obterSessao().id;
  const [papel, setPapel] = useState('');
  const [ativo, setAtivo] = useState('');
  const [modal, setModal] = useState(null); // { tipo, u }
  const [versao, setVersao] = useState(0); // muda para recarregar a lista
  const fechar = () => setModal(null);
  const refazer = () => setVersao((v) => v + 1);

  async function agir(caminho, metodo, corpo, msg) {
    const r = await seguro(() => chamar(caminho, { metodo, corpo }));
    if (!r) return false;
    if (msg) avisar(msg);
    refazer();
    return true;
  }
  const confirmar = (t) => window.confirm(t);

  const acoes = (u) => {
    const outro = u.id !== eu;
    return (
      <span className="flex flex-wrap gap-1.5">
        <Botao mini variante="sec" onClick={() => setModal({ tipo: 'nome', u })}>Nome</Botao>
        {u.papel !== 'SUPERUSUARIO' && outro && <Botao mini variante="sec" onClick={() => setModal({ tipo: 'papel', u })}>Papel</Botao>}
        {outro && <Botao mini variante="sec" onClick={() => { if (!u.ativo || confirmar(`Desativar ${u.usuario}? Ele não conseguirá mais entrar.`)) agir(A(`/usuarios/${u.id}/ativo`), 'PATCH', { ativo: !u.ativo }, u.ativo ? 'Usuário desativado' : 'Usuário ativado'); }}>{u.ativo ? 'Desativar' : 'Ativar'}</Botao>}
        {outro && <Botao mini variante="sec" onClick={() => setModal({ tipo: 'senha', u })}>Nova senha</Botao>}
        {!outro && <Botao mini variante="sec" onClick={() => ir('conta')}>Alterar minha senha</Botao>}
        {outro && u.papel !== 'SUPERUSUARIO' && <Botao mini variante="perigo" onClick={() => { if (confirmar(`Excluir ${u.usuario} de vez? Não dá para desfazer. O histórico dele continua nos registros de auditoria. Para só bloquear o acesso, use Desativar.`)) agir(A(`/usuarios/${u.id}`), 'DELETE', undefined, 'Usuário excluído'); }}>Excluir</Botao>}
      </span>
    );
  };

  const u = modal && modal.u;
  return (
    <div>
      <Cabeca titulo="Usuários" texto="Só o superusuário cria e administra contas. A senha que você define para os outros é provisória: a pessoa será obrigada a trocá-la no primeiro acesso. A sua própria senha você altera em Minha conta." />
      <Acoes className="mb-3"><Botao onClick={() => setModal({ tipo: 'novo' })}>Novo usuário</Botao></Acoes>
      <LinhaCampos>
        <Campo rotulo="Papel">{(i) => <Seletor id={i} opcoes={PAPEIS} vazio="Todos os papéis" value={papel} onChange={(e) => setPapel(e.target.value)} />}</Campo>
        <Campo rotulo="Situação">{(i) => <Seletor id={i} opcoes={{ true: 'Ativos', false: 'Inativos' }} vazio="Todos" value={ativo} onChange={(e) => setAtivo(e.target.value)} />}</Campo>
      </LinhaCampos>
      <ListaPaginada deps={[papel, ativo, versao]} vazio="Nenhum usuário encontrado."
        buscar={(pagina, limite) => chamar(A(`/usuarios?${qs({ pagina, limite, papel, ativo })}`))}
        colunas={[
          { titulo: 'Usuário', ver: (x) => x.usuario + (x.id === eu ? ' (você)' : '') }, { titulo: 'Nome', ver: (x) => x.nome || '-' }, { titulo: 'Papel', ver: (x) => PAPEIS[x.papel] || x.papel },
          { titulo: 'Situação', ver: (x) => (<span className="flex flex-wrap gap-1"><Selo tipo={x.ativo ? 'ok' : 'erro'}>{x.ativo ? 'Ativo' : 'Inativo'}</Selo>{x.trocaSenhaObrigatoria && <Selo tipo="andamento">Troca de senha pendente</Selo>}</span>) },
          { titulo: 'Último acesso', ver: (x) => data(x.ultimoAcesso) }, { titulo: '', ver: acoes }]} />

      {modal && modal.tipo === 'novo' && (
        <FormModal titulo="Novo usuário" botao="Criar usuário" aoFechar={fechar} aoEnviar={(v) => agir(A('/usuarios'), 'POST', v, 'Usuário criado')}
          campos={[
            { n: 'usuario', rot: 'Login', req: true, min: 3, max: 60, dica: 'Letras, números, ponto, hífen e sublinhado.' },
            { n: 'nome', rot: 'Nome de exibição', max: 120 },
            { n: 'senha', rot: 'Senha provisória', tipo: 'password', req: true, min: 8, max: 72, dica: 'De 8 a 72 caracteres, com letra e número. No primeiro acesso a pessoa define a própria senha.' },
            { n: 'papel', rot: 'Papel', op: PAPEIS_COMUNS, valor: 'GESTOR_ALMOXARIFADO' }]} />
      )}
      {modal && modal.tipo === 'nome' && (
        <FormModal titulo="Alterar nome" aoFechar={fechar} aoEnviar={(v) => agir(A(`/usuarios/${u.id}/nome`), 'PATCH', { nome: v.nome, versao: u.versao }, 'Nome alterado')}
          campos={[{ n: 'nome', rot: 'Nome de exibição', valor: u.nome, req: true, min: 2, max: 120 }]} />
      )}
      {modal && modal.tipo === 'papel' && (
        <FormModal titulo="Trocar papel" aoFechar={fechar} aoEnviar={(v) => agir(A(`/usuarios/${u.id}`), 'PUT', { papel: v.papel, versao: u.versao }, 'Papel alterado')}
          campos={[{ n: 'papel', rot: 'Novo papel', op: PAPEIS_COMUNS, valor: u.papel }]} />
      )}
      {modal && modal.tipo === 'senha' && (
        <FormModal titulo="Redefinir senha" aoFechar={fechar} aoEnviar={(v) => agir(A(`/usuarios/${u.id}/redefinir-senha`), 'POST', { novaSenha: v.novaSenha }, 'Senha redefinida')}
          campos={[{ n: 'novaSenha', rot: 'Nova senha provisória', tipo: 'password', req: true, min: 8, max: 72, dica: 'A pessoa precisará trocá-la no próximo acesso. Também libera um login bloqueado por tentativas.' }]} />
      )}
    </div>
  );
}

// Arthur Oliver Rossi Alves, autor do Greencode.
