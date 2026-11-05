import { useState } from 'react';
import { I, P, chamar, definirSessao, seguro } from '../lib/api.js';
import { ir } from '../lib/hooks.js';
import { Botao, Campo, ETAPAS, Entrada as Input, Trilha } from '../components/ui.jsx';

export default function Entrada() {
  const [aba, setAba] = useState('parceiro');
  return (
    <div className="grid min-h-screen md:grid-cols-[1.2fr_1fr]">
      <section className="flex flex-col justify-center bg-lateral p-[clamp(1.5rem,5vw,4rem)] text-[#e6efe9]">
        <h1 className="mb-3 max-w-[20ch] font-titulo text-[clamp(2rem,4.2vw,3.2rem)] font-semibold leading-[1.1] tracking-tight">Cada equipamento, do recebimento à baixa.</h1>
        <p className="max-w-[48ch] text-[#b9cdc2]">Acompanhe o caminho dos seus eletrônicos descartados, registre novos lotes e consulte quanto material foi recuperado.</p>
        <div aria-hidden="true" className="max-w-[560px]">
          <Trilha visitados={new Set(ETAPAS.flatMap(([, s]) => s))} atual="" escura animada />
        </div>
      </section>
      <section className="flex max-w-[520px] flex-col justify-center p-[clamp(1.5rem,5vw,3.5rem)]">
        <h2 className="mb-4 font-titulo text-[1.5rem] font-semibold">Entrar</h2>
        <div role="tablist" className="mb-5 flex border-b border-linha">
          {[['parceiro', 'Sou parceiro'], ['interno', 'Equipe interna']].map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
              className={`-mb-px cursor-pointer border-0 border-b-2 bg-transparent px-4 py-2 ${aba === k ? 'border-acao font-semibold text-acao' : 'border-transparent text-suave'}`}>{t}</button>
          ))}
        </div>
        {aba === 'parceiro' ? <FormParceiro /> : <FormInterno />}
        <p className="mt-6 text-[0.9rem] text-suave">Desenvolvedor? A documentação da API está no <a className="text-acao underline" href="/docs">Swagger</a>.</p>
      </section>
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
      <p className="mb-3 text-suave">Use a chave de API que a equipe do Greencode entregou à sua organização.</p>
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
