import { useState } from 'react';
import { I, P, chamar, definirSessao, seguro } from '../lib/api.js';
import { ir } from '../lib/hooks.js';
import { Botao, Campo, ETAPAS, Entrada as Input, Trilha } from '../components/ui.jsx';

export default function Entrada() {
  const [aba, setAba] = useState('parceiro');
  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b-[3px] border-linha bg-superficie px-[clamp(1rem,4vw,3rem)] py-3">
        <span className="font-titulo text-[1.3rem] font-bold uppercase tracking-[-0.03em]"><span aria-hidden="true" className="mr-2 inline-block h-3 w-3 rotate-45 bg-acao" />Greencode</span>
      </div>
      <div className="mx-auto grid w-full max-w-[1240px] flex-1 items-center gap-10 px-[clamp(1rem,4vw,3rem)] py-12 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <section className="order-2 border-[3px] border-linha bg-superficie shadow-[10px_10px_0_var(--sombra)] lg:order-1">
          <h2 className="m-0 bg-tinta px-6 py-3 font-titulo text-[1.3rem] font-bold uppercase tracking-tight text-papel">Entrar</h2>
          <div className="p-6">
            <div role="tablist" className="mb-6 grid grid-cols-2 border-2 border-linha">
              {[['parceiro', 'Sou parceiro'], ['interno', 'Equipe interna']].map(([k, t]) => (
                <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
                  className={`cursor-pointer border-0 px-3 py-2.5 font-mono text-[0.75rem] font-semibold uppercase tracking-wider ${aba === k ? 'bg-acao text-white' : 'bg-transparent text-suave hover:bg-papel'}`}>{t}</button>
              ))}
            </div>
            {aba === 'parceiro' ? <FormParceiro /> : <FormInterno />}
          </div>
          <p className="m-0 border-t-2 border-linha bg-papel px-6 py-3 font-mono text-[0.78rem] text-suave">Desenvolvedor? A documentação da API está no <a className="font-semibold text-acao underline" href="/docs">Swagger</a>.</p>
        </section>
        <section className="order-1 lg:order-2">
          <p className="mb-4 inline-block bg-sinal px-2 py-0.5 font-mono text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-white">Rastreabilidade de eletrônicos</p>
          <h1 className="mb-5 max-w-[16ch] font-titulo text-[clamp(2.4rem,6vw,5rem)] font-bold uppercase leading-[0.9] tracking-[-0.05em]">Cada equipamento, do recebimento à <span className="text-acao">baixa.</span></h1>
          <p className="max-w-[52ch] font-mono text-[0.9rem] text-suave">Acompanhe o caminho dos seus eletrônicos descartados, registre novos lotes e consulte quanto material foi recuperado.</p>
          <div aria-hidden="true" className="max-w-[680px]">
            <Trilha visitados={new Set(ETAPAS.flatMap(([, s]) => s))} atual="" animada />
          </div>
        </section>
      </div>
    </div>
  );
}

function FormParceiro() {
  const [chave, setChave] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(ev) {
    ev.preventDefault();
    setEnviando(true);
    definirSessao({ modo: 'parceiro', chave: chave.trim() });
    const r = await seguro(() => chamar(P('/eu')));
    setEnviando(false);
    if (!r) { definirSessao(null); return; }
    definirSessao({ modo: 'parceiro', chave: chave.trim(), nome: r.dados.chave, organizacaoId: r.dados.organizacaoId, permissoes: r.dados.permissoes, id: r.dados.organizacaoId + r.dados.chave });
    ir('inicio');
  }
  return (
    <form onSubmit={enviar}>
      <p className="mb-4 text-[0.92rem] text-suave">Use a chave de API que a equipe do Greencode entregou à sua organização.</p>
      <Campo rotulo="Chave de API">{(id) => <Input id={id} type="password" autoComplete="off" required placeholder="gck_..." value={chave} onChange={(e) => setChave(e.target.value)} />}</Campo>
      <Botao type="submit" disabled={enviando}>Entrar</Botao>
    </form>
  );
}

function FormInterno() {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function enviar(ev) {
    ev.preventDefault();
    setEnviando(true);
    definirSessao({ modo: 'interno' });
    const login = await seguro(() => chamar(I('/auth/login'), { metodo: 'POST', corpo: { usuario, senha } }));
    if (!login) { definirSessao(null); setEnviando(false); return; }
    definirSessao({ modo: 'interno', token: login.dados.token });
    // /auth/me continua liberada mesmo com a senha provisória pendente
    const eu = await seguro(() => chamar(I('/auth/me')));
    setEnviando(false);
    if (!eu) { definirSessao(null); return; }
    definirSessao({ modo: 'interno', token: login.dados.token, usuario: eu.dados.usuario, nome: eu.dados.nome, papel: eu.dados.papel, id: eu.dados.id, trocaPendente: !!login.dados.trocaSenhaObrigatoria });
    ir('inicio');
  }
  return (
    <form onSubmit={enviar}>
      <Campo rotulo="Usuário">{(id) => <Input id={id} autoComplete="username" required value={usuario} onChange={(e) => setUsuario(e.target.value)} />}</Campo>
      <Campo rotulo="Senha">{(id) => <Input id={id} type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />}</Campo>
      <Botao type="submit" disabled={enviando}>Entrar</Botao>
    </form>
  );
}

// Oliver passou por aqui.
