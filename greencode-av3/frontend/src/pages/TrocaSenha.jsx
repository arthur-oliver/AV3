import { useState } from 'react';
import { I, avisar, atualizarSessao, chamar, obterSessao, sair, seguro } from '../lib/api.js';
import { ir } from '../lib/hooks.js';
import { Botao, Campo, Entrada, Cabeca } from '../components/ui.jsx';

// Regras mostradas na tela. São as mesmas que a API confere (a API é quem decide de verdade).
function regras(atual, nova, confirmacao) {
  return [
    ['Ao menos 8 caracteres', nova.length >= 8 && nova.length <= 72],
    ['Ao menos uma letra', /[A-Za-z]/.test(nova)],
    ['Ao menos um número', /\d/.test(nova)],
    ['Diferente da senha atual', nova.length > 0 && nova !== atual],
    ['Confirmação igual à nova senha', confirmacao.length > 0 && confirmacao === nova]
  ];
}

// Formulário de troca de senha: usado na tela obrigatória do primeiro acesso e em "Minha conta".
export function FormSenha({ forcado, aoConcluir }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const lista = regras(atual, nova, confirmacao);
  const valido = atual.length > 0 && lista.every(([, ok]) => ok);
  const tipo = ver ? 'text' : 'password';

  async function enviar(ev) {
    ev.preventDefault();
    if (!valido) return;
    setEnviando(true);
    const r = await seguro(() => chamar(I('/auth/alterar-senha'), { metodo: 'POST', corpo: { senhaAtual: atual, novaSenha: nova } }));
    setEnviando(false);
    if (!r) return;
    avisar('Senha alterada', forcado ? 'Pronto, agora é só usar o portal.' : undefined);
    setAtual(''); setNova(''); setConfirmacao('');
    aoConcluir();
  }

  return (
    <form onSubmit={enviar} noValidate>
      <Campo rotulo={forcado ? 'Senha provisória (a que você recebeu)' : 'Senha atual'}>
        {(id) => <Entrada id={id} type={tipo} autoComplete="current-password" required value={atual} onChange={(e) => setAtual(e.target.value)} />}
      </Campo>
      <Campo rotulo="Nova senha">
        {(id) => <Entrada id={id} type={tipo} autoComplete="new-password" required maxLength={72} value={nova} onChange={(e) => setNova(e.target.value)} />}
      </Campo>
      <Campo rotulo="Repita a nova senha">
        {(id) => <Entrada id={id} type={tipo} autoComplete="new-password" required maxLength={72} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />}
      </Campo>
      <label className="mb-3 flex items-center gap-2 text-[0.9rem] text-suave">
        <input type="checkbox" className="h-4 w-4" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar as senhas
      </label>
      <ul className="mb-4 grid gap-1 text-[0.88rem]" aria-label="Requisitos da nova senha">
        {lista.map(([texto, ok]) => (
          <li key={texto} className={ok ? 'text-ok' : 'text-suave'}>
            <span aria-hidden="true">{ok ? '✓' : '○'}</span> {texto}
            <span className="sr-only">{ok ? ' (atendido)' : ' (pendente)'}</span>
          </li>
        ))}
      </ul>
      <Botao type="submit" disabled={!valido || enviando}>{forcado ? 'Definir senha e continuar' : 'Alterar senha'}</Botao>
    </form>
  );
}

// Tela cheia, sem menu: enquanto a senha provisória não for trocada, nada mais do portal fica acessível.
export function TrocaSenhaTela() {
  const s = obterSessao();
  async function concluir() {
    const eu = await seguro(() => chamar(I('/auth/me')));
    atualizarSessao({ trocaPendente: false, ...(eu ? { nome: eu.dados.nome } : {}) });
    ir('inicio');
  }
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[460px] rounded border border-linha bg-superficie p-6 sm:p-8">
        <Cabeca titulo="Defina a sua senha" texto={`Olá, ${s.nome || s.usuario}. A senha que você recebeu é provisória. Para continuar, escolha uma senha só sua.`} />
        <FormSenha forcado aoConcluir={concluir} />
        <p className="mt-5 text-[0.88rem] text-suave">
          Não é você? <button type="button" onClick={sair} className="cursor-pointer border-0 bg-transparent p-0 text-acao underline">Sair</button>
        </p>
      </div>
    </div>
  );
}

// Oliver passou por aqui.
