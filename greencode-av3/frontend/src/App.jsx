// Portal Greencode: escolhe a tela conforme a sessão (parceiro, equipe interna ou troca de senha obrigatória).
// Arthur Oliver Rossi Alves, autor do Greencode.
import { Avisos, Moldura, ProtecaoTela } from './components/Layout.jsx';
import { obterSessao, useSessao } from './lib/api.js';
import { useRota } from './lib/hooks.js';
import { ehSuper, podeAdministrar, podeAuditar } from './lib/papeis.js';
import { Cabeca, Vazio } from './components/ui.jsx';
import Entrada from './pages/Entrada.jsx';
import { TrocaSenhaTela } from './pages/TrocaSenha.jsx';
import Pedidos from './pages/Pedidos.jsx';
import { AnalisesInterno, AnalisesParceiro } from './pages/analises.jsx';
import { InicioParceiro, LotesParceiro, NovoLoteParceiro, Rastrear } from './pages/Parceiro.jsx';
import Usuarios from './pages/interno/Usuarios.jsx';
import Organizacoes from './pages/interno/Organizacoes.jsx';
import Lotes from './pages/interno/Lotes.jsx';
import Equipamentos from './pages/interno/Equipamentos.jsx';
import { Auditoria, RelatoriosConsulta } from './pages/interno/Consultas.jsx';
import { Chaves, Fila } from './pages/interno/Admin.jsx';
import Conta, { InicioInterno } from './pages/interno/Conta.jsx';

function menuParceiro(s) {
  const tem = (p) => (s.permissoes || []).includes(p);
  return [
    { chave: 'inicio', titulo: 'Início', tela: () => <InicioParceiro /> },
    tem('LER_RASTREABILIDADE') && { chave: 'lotes', titulo: 'Lotes', tela: (id) => <LotesParceiro id={id} /> },
    tem('LER_RASTREABILIDADE') && { chave: 'rastrear', titulo: 'Rastrear equipamento', tela: (id) => <Rastrear id={id} /> },
    tem('ESCREVER_LOTES') && { chave: 'novo-lote', titulo: 'Registrar lote', tela: () => <NovoLoteParceiro /> },
    tem('LER_RELATORIOS') && { chave: 'analises', titulo: 'Análises', tela: () => <AnalisesParceiro /> },
    tem('LER_RELATORIOS') && { chave: 'pedidos', titulo: 'Pedidos de relatório', tela: () => <Pedidos /> }
  ].filter(Boolean);
}

function menuInterno() {
  return [
    { chave: 'inicio', titulo: 'Início', tela: () => <InicioInterno /> },
    ehSuper() && { chave: 'usuarios', titulo: 'Usuários', tela: () => <Usuarios /> },
    { chave: 'organizacoes', titulo: 'Organizações', tela: (id) => <Organizacoes id={id} /> },
    { chave: 'lotes', titulo: 'Lotes', tela: (id) => <Lotes id={id} /> },
    { chave: 'equipamentos', titulo: 'Equipamentos', tela: (id) => <Equipamentos id={id} /> },
    { chave: 'relatorios', titulo: 'Relatórios', tela: () => <RelatoriosConsulta /> },
    podeAuditar() && { chave: 'auditoria', titulo: 'Auditoria', tela: () => <Auditoria /> },
    podeAuditar() && { chave: 'analises', titulo: 'Análises', tela: () => <AnalisesInterno /> },
    podeAuditar() && { chave: 'pedidos', titulo: 'Pedidos de relatório', tela: () => <Pedidos /> },
    podeAdministrar() && { chave: 'chaves', titulo: 'Chaves de API', tela: () => <Chaves /> },
    podeAdministrar() && { chave: 'fila', titulo: 'Fila', tela: () => <Fila /> },
    { chave: 'conta', titulo: 'Minha conta', tela: () => <Conta /> }
  ].filter(Boolean);
}

export default function App() {
  const sessao = useSessao();
  const { rota, id } = useRota();
  let corpo;
  // sessão sem "id" é a credencial provisória do login em andamento: a tela de entrada continua montada
  if (!sessao || !sessao.id) corpo = <Entrada />;
  else if (sessao.modo === 'interno' && sessao.trocaPendente) corpo = <TrocaSenhaTela />;
  else {
    const interno = sessao.modo === 'interno';
    const itens = interno ? menuInterno() : menuParceiro(sessao);
    const atual = itens.find((m) => m.chave === rota) || itens[0];
    corpo = (
      <Moldura subtitulo={interno ? 'Equipe interna' : 'Portal do parceiro'} itens={itens} rotaAtual={atual.chave} nome={sessao.nome || sessao.usuario} mostrarLimite={!interno}>
        {rota && !itens.some((m) => m.chave === rota) && rota !== 'inicio' ? <Vazio>Esta tela não existe ou o seu acesso não a inclui.</Vazio> : null}
        <div key={`${atual.chave}/${id}`}><ProtecaoTela>{atual.tela(id)}</ProtecaoTela></div>
      </Moldura>
    );
  }
  return (
    <>
      {corpo}
      <Avisos />
    </>
  );
}
