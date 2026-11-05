import { useAvisos, fecharAviso, useLimite, sair } from '../lib/api.js';

export function Avisos() {
  const avisos = useAvisos();
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-50 grid w-[min(380px,calc(100vw-2rem))] gap-2">
      {avisos.map((a) => (
        <div
          key={a.id}
          role={a.tipo === 'erro' ? 'alert' : 'status'}
          className={`flex items-start gap-3 rounded border bg-superficie px-3.5 py-2.5 shadow-lg ${a.tipo === 'erro' ? 'border-erro' : 'border-ok'}`}
        >
          <div className="flex-1">
            <b className={`block ${a.tipo === 'erro' ? 'text-erro' : 'text-ok'}`}>{a.titulo}</b>
            {a.texto}
          </div>
          <button type="button" aria-label="Fechar aviso" className="cursor-pointer border-0 bg-transparent p-0 text-lg leading-none text-suave" onClick={() => fecharAviso(a.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

// Moldura do portal: menu lateral escuro + conteúdo. Em tela estreita o menu vai para o topo.
export function Moldura({ subtitulo, itens, rotaAtual, nome, children, mostrarLimite }) {
  const limite = useLimite();
  return (
    <div className="grid min-h-screen grid-cols-[minmax(0,1fr)] md:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="flex flex-col gap-4 bg-lateral p-4 text-[#e6efe9] md:sticky md:top-0 md:h-screen md:py-6">
        <div className="px-1.5 font-titulo text-[1.35rem]">
          Greencode
          <small className="mt-0.5 block font-sans text-[0.75rem] opacity-65">{subtitulo}</small>
        </div>
        <nav aria-label="Principal" className="flex gap-0.5 overflow-x-auto md:flex-col md:overflow-visible">
          {itens.map((m) => (
            <a
              key={m.chave}
              href={`#/${m.chave}`}
              aria-current={m.chave === rotaAtual ? 'page' : undefined}
              className="whitespace-nowrap rounded border-l-[3px] border-transparent px-2.5 py-2 text-[#cfe0d6] no-underline hover:bg-white/10 aria-[current=page]:border-brilho aria-[current=page]:bg-white/10 aria-[current=page]:text-white"
            >
              {m.titulo}
            </a>
          ))}
        </nav>
        <div className="grid gap-2 text-[0.82rem] opacity-90 md:mt-auto">
          {mostrarLimite && (
            <div>
              <div>{limite ? `${limite.restante} de ${limite.limite} requisições neste minuto` : 'Limite de requisições'}</div>
              <div className="mt-1 h-1 overflow-hidden rounded-sm bg-white/20">
                <span className="block h-full bg-brilho" style={{ width: limite ? `${(limite.restante / limite.limite) * 100}%` : '100%' }} />
              </div>
            </div>
          )}
          <div>{nome}</div>
          <button type="button" onClick={sair} className="cursor-pointer rounded border border-white/35 bg-transparent px-4 py-2 text-white hover:bg-white/10">Sair</button>
        </div>
      </aside>
      <main id="conteudo" tabIndex={-1} className="w-full max-w-[1180px] px-[clamp(1rem,4vw,3rem)] pb-16 pt-8">
        {children}
      </main>
    </div>
  );
}

// Arthur Oliver Rossi Alves, autor do Greencode.
