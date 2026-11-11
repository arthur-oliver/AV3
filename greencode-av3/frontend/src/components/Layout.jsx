import { Component } from 'react';
import { useAvisos, fecharAviso, useLimite, sair } from '../lib/api.js';

// Se uma tela quebrar ao desenhar, mostra o aviso só no lugar dela: o cabeçalho e o menu continuam funcionando.
// A tela é remontada (e esta proteção zerada) a cada troca de rota, pelo "key" que o App coloca em volta.
export class ProtecaoTela extends Component {
  state = { erro: null };
  static getDerivedStateFromError(erro) {
    return { erro };
  }
  componentDidCatch(erro, info) {
    console.error('Erro ao exibir a tela:', erro, info.componentStack);
  }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div role="alert" className="border-2 border-linha border-l-[10px] border-l-erro bg-superficie p-5 shadow-[6px_6px_0_var(--sombra)]">
        <b className="block font-mono text-[0.78rem] uppercase tracking-[0.12em] text-erro">Não foi possível exibir esta tela</b>
        <p className="mb-0 mt-2">Use o menu acima para ir a outra parte do portal ou recarregue a página para tentar de novo.</p>
      </div>
    );
  }
}

export function Avisos() {
  const avisos = useAvisos();
  return (
    <div aria-live="polite" className="fixed left-1/2 top-4 z-50 grid w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 gap-3">
      {avisos.map((a) => (
        <div
          key={a.id}
          role={a.tipo === 'erro' ? 'alert' : 'status'}
          className={`flex items-start gap-3 border-2 border-linha border-l-[10px] bg-superficie px-4 py-3 shadow-[5px_5px_0_var(--sombra)] ${a.tipo === 'erro' ? 'border-l-erro' : 'border-l-ok'}`}
        >
          <div className="flex-1">
            <b className={`block font-mono text-[0.78rem] uppercase tracking-[0.12em] ${a.tipo === 'erro' ? 'text-erro' : 'text-ok'}`}>{a.titulo}</b>
            {a.texto}
          </div>
          <button type="button" aria-label="Fechar aviso" className="cursor-pointer border-2 border-linha bg-transparent px-1.5 font-mono text-sm leading-tight text-tinta hover:bg-tinta hover:text-papel" onClick={() => fecharAviso(a.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

// Moldura do portal: cabeçalho claro no topo com a navegação em abas e o conteúdo centralizado abaixo.
export function Moldura({ subtitulo, itens, rotaAtual, nome, children, mostrarLimite }) {
  const limite = useLimite();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b-[3px] border-linha bg-superficie">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-6 gap-y-3 px-[clamp(1rem,3vw,2rem)] py-3">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid h-10 w-10 rotate-45 place-items-center bg-acao">
              <span className="block h-3 w-3 -rotate-45 bg-superficie" />
            </span>
            <div className="leading-none">
              <span className="block font-titulo text-[1.45rem] font-bold uppercase tracking-[-0.03em]">Greencode</span>
              <small className="mt-1 block font-mono text-[0.7rem] uppercase tracking-[0.18em] text-suave">{subtitulo}</small>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-4 font-mono text-[0.78rem]">
            {mostrarLimite && (
              <div className="min-w-[180px]">
                <div className="uppercase tracking-wider text-suave">{limite ? `${limite.restante}/${limite.limite} req. neste minuto` : 'Limite de requisições'}</div>
                <div className="mt-1 h-2 border-2 border-linha bg-papel">
                  <span className="block h-full bg-acao" style={{ width: limite ? `${(limite.restante / limite.limite) * 100}%` : '100%' }} />
                </div>
              </div>
            )}
            <span className="border-2 border-linha bg-papel px-2.5 py-1.5 font-semibold">{nome}</span>
            <button type="button" onClick={sair} className="cursor-pointer border-2 border-linha bg-tinta px-3.5 py-1.5 font-mono font-semibold uppercase tracking-wider text-papel hover:bg-acao hover:text-white">Sair</button>
          </div>
        </div>
        <nav aria-label="Principal" className="border-t-2 border-linha bg-tinta">
          <div className="mx-auto flex max-w-[1320px] gap-1 overflow-x-auto px-[clamp(1rem,3vw,2rem)] py-2">
            {itens.map((m) => (
              <a
                key={m.chave}
                href={`#/${m.chave}`}
                aria-current={m.chave === rotaAtual ? 'page' : undefined}
                className="whitespace-nowrap border-2 border-transparent px-3 py-1 font-mono text-[0.8rem] uppercase tracking-wider text-papel/80 no-underline hover:border-papel/60 hover:text-papel aria-[current=page]:border-acao aria-[current=page]:bg-acao aria-[current=page]:text-white"
              >
                {m.titulo}
              </a>
            ))}
          </div>
        </nav>
      </header>
      <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-[1320px] px-[clamp(1rem,3vw,2rem)] pb-20 pt-10">
        {children}
      </main>
    </div>
  );
}

// Arthur Oliver Rossi Alves, autor do Greencode.
