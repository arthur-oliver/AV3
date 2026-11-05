import { useEffect, useId, useRef, useState } from 'react';
import { usePaginada } from '../lib/hooks.js';
import { rotulo, STATUS } from '../lib/rotulos.js';

const cx = (...c) => c.filter(Boolean).join(' ');

// ---------- botões e campos ----------
const BOTAO = {
  primario: 'border-acao bg-acao text-white hover:bg-acao-escura hover:border-acao-escura',
  sec: 'border-acao bg-transparent text-acao hover:bg-acao/10',
  perigo: 'border-erro bg-transparent text-erro hover:bg-erro/10'
};
export function Botao({ variante = 'primario', mini, className, type = 'button', ...resto }) {
  return (
    <button
      type={type}
      className={cx('cursor-pointer rounded border font-[inherit] disabled:cursor-not-allowed disabled:opacity-50', mini ? 'px-2 py-0.5 text-[0.85rem]' : 'px-4 py-2', BOTAO[variante], className)}
      {...resto}
    />
  );
}

export const CLASSE_CAMPO = 'w-full rounded border border-linha bg-superficie px-2.5 py-1.5 text-tinta';
export const Entrada = ({ className, ...p }) => <input className={cx(CLASSE_CAMPO, className)} {...p} />;
export const AreaTexto = ({ className, ...p }) => <textarea className={cx(CLASSE_CAMPO, className)} {...p} />;
export function Seletor({ opcoes, vazio, className, ...p }) {
  return (
    <select className={cx(CLASSE_CAMPO, className)} {...p}>
      {vazio !== undefined && <option value="">{vazio}</option>}
      {Object.entries(opcoes || {}).map(([k, v]) => (
        <option key={k} value={k}>{v}</option>
      ))}
    </select>
  );
}

// Rótulo + controle + dica. O controle recebe o id automaticamente.
export function Campo({ rotulo: texto, dica, children, className }) {
  const id = useId();
  return (
    <div className={cx('mb-3.5', className)}>
      <label htmlFor={id} className="mb-1 block text-[0.85rem] text-suave">{texto}</label>
      {typeof children === 'function' ? children(id) : children}
      {dica && <p className="mt-1 text-[0.82rem] text-suave">{dica}</p>}
    </div>
  );
}
export const LinhaCampos = ({ children }) => <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">{children}</div>;
export const Acoes = ({ children, className }) => <div className={cx('mt-1.5 flex flex-wrap items-center gap-2.5', className)}>{children}</div>;

// ---------- estrutura ----------
export function Cabeca({ titulo, texto, id }) {
  return (
    <header className="mb-5">
      <h1 id={id} className="mb-2 font-titulo text-[1.9rem] font-semibold leading-tight tracking-tight">{titulo}</h1>
      {texto && <p className="max-w-[68ch] text-suave">{texto}</p>}
    </header>
  );
}
export const H2 = ({ children, className }) => <h2 className={cx('mb-2 mt-7 font-titulo text-[1.3rem] font-semibold leading-tight', className)}>{children}</h2>;
export const H3 = ({ children, className }) => <h3 className={cx('mb-2 mt-6 font-titulo text-[1.05rem] font-semibold leading-tight', className)}>{children}</h3>;
export const Painel = ({ children, className, ...p }) => <div className={cx('mb-4 rounded border border-linha bg-superficie p-4', className)} {...p}>{children}</div>;
export const Suave = ({ children, className }) => <p className={cx('text-[0.9rem] text-suave', className)}>{children}</p>;
export const Vazio = ({ children }) => <p className="py-2 text-suave">{children}</p>;
export const Carregando = () => <p className="py-2 text-suave">Carregando...</p>;
export const Voltar = ({ para, children }) => <p className="mb-3"><a className="text-acao underline" href={`#/${para}`}>{children}</a></p>;

const SELO = { ok: 'border-ok text-ok', erro: 'border-erro text-erro', andamento: 'border-sinal text-sinal', '': 'border-linha text-tinta' };
export const Selo = ({ tipo = '', children }) => <span className={cx('inline-block whitespace-nowrap rounded-full border px-2 py-px text-[0.8rem]', SELO[tipo])}>{children}</span>;
export const SeloStatus = ({ status }) => <Selo>{rotulo(STATUS, status)}</Selo>;

export function Indicadores({ itens }) {
  return (
    <dl className="my-4 grid border-l border-t border-linha [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
      {itens.map(([titulo, valor]) => (
        <div key={titulo} className="border-b border-r border-linha p-3">
          <dt className="text-[0.82rem] text-suave">{titulo}</dt>
          <dd className="m-0 break-words font-titulo text-[1.35rem] leading-snug">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------- tabela ----------
// colunas: [{ titulo, num, ver: (linha) => node }]
export function Tabela({ colunas, linhas, aoClicar, vazio = 'Nada para mostrar.' }) {
  if (!linhas || !linhas.length) return <Vazio>{vazio}</Vazio>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {colunas.map((c, i) => (
              <th key={i} className={cx('border-b border-linha px-2 py-2 text-[0.82rem] font-semibold text-suave', c.num && 'text-right')}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr
              key={l.id || i}
              className={cx('border-b border-linha align-top', aoClicar && 'cursor-pointer hover:bg-acao/5')}
              tabIndex={aoClicar ? 0 : undefined}
              onClick={aoClicar ? () => aoClicar(l) : undefined}
              onKeyDown={aoClicar ? (ev) => ev.key === 'Enter' && aoClicar(l) : undefined}
            >
              {colunas.map((c, j) => (
                <td key={j} className={cx('px-2 py-2', c.num && 'text-right tabular-nums')}>{c.ver(l)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Barra({ valor, maximo, negativo }) {
  const largura = maximo ? Math.max(2, Math.min(100, (Math.abs(valor) / maximo) * 100)) : 2;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cx('inline-block h-2.5 rounded-sm', negativo ? 'bg-erro' : 'bg-acao')} style={{ width: `${largura}px` }} />
      {Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
    </span>
  );
}

// Tabela + paginação. buscar(pagina, tamanho) devolve { dados, total }.
export function ListaPaginada({ buscar, deps, colunas, aoClicar, vazio, tamanho }) {
  const p = usePaginada(buscar, deps, tamanho);
  return (
    <div>
      {p.carregando && !p.dados ? <Carregando /> : <Tabela colunas={colunas} linhas={p.dados} aoClicar={aoClicar} vazio={vazio} />}
      <div className="mt-3 flex items-center gap-3 text-[0.9rem]">
        <Botao variante="sec" mini disabled={p.pagina <= 1} onClick={() => p.setPagina(p.pagina - 1)}>Anterior</Botao>
        <span>Página {p.pagina} de {p.ultima} ({p.total} no total)</span>
        <Botao variante="sec" mini disabled={p.pagina >= p.ultima} onClick={() => p.setPagina(p.pagina + 1)}>Próxima</Botao>
      </div>
    </div>
  );
}

// ---------- diálogos ----------
export function Dialogo({ titulo, aoFechar, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d && d.open && d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(560px,calc(100vw-2rem))] overflow-auto rounded-md border border-linha bg-superficie p-6 text-tinta"
    >
      <h2 className="mb-3 font-titulo text-[1.3rem] font-semibold">{titulo}</h2>
      {children}
    </dialog>
  );
}

// Formulário em janela. campos: [{ n, rot, tipo, op, vazio, valor, req, dica, min, max, step, linhas }]
// aoEnviar(valores) devolve (ou promete) true se deu certo; só então a janela fecha.
export function FormModal({ titulo, campos, aoEnviar, botao = 'Salvar', aoFechar }) {
  const [valores, setValores] = useState(() => Object.fromEntries(campos.map((c) => [c.n, c.tipo === 'check' ? !!c.valor : c.valor === undefined || c.valor === null ? '' : String(c.valor)])));
  const [enviando, setEnviando] = useState(false);
  const mudar = (n, v) => setValores((x) => ({ ...x, [n]: v }));

  async function enviar(ev) {
    ev.preventDefault();
    const saida = {};
    for (const c of campos) {
      const v = valores[c.n];
      if (c.tipo === 'check') saida[c.n] = v;
      else if (String(v).trim() === '') saida[c.n] = undefined;
      else saida[c.n] = c.tipo === 'number' ? Number(v) : String(v).trim();
    }
    setEnviando(true);
    const ok = await aoEnviar(saida);
    setEnviando(false);
    if (ok) aoFechar();
  }

  return (
    <Dialogo titulo={titulo} aoFechar={aoFechar}>
      <form onSubmit={enviar}>
        {campos.map((c) => (
          <Campo key={c.n} rotulo={c.rot} dica={c.dica}>
            {(id) => {
              if (c.op) return <Seletor id={id} opcoes={c.op} vazio={c.vazio} value={valores[c.n]} onChange={(e) => mudar(c.n, e.target.value)} />;
              if (c.tipo === 'check') return <input id={id} type="checkbox" className="h-4 w-4" checked={valores[c.n]} onChange={(e) => mudar(c.n, e.target.checked)} />;
              if (c.linhas) return <AreaTexto id={id} rows={c.linhas} maxLength={c.max} required={c.req} value={valores[c.n]} onChange={(e) => mudar(c.n, e.target.value)} />;
              return (
                <Entrada id={id} type={c.tipo || 'text'} required={c.req} minLength={c.min} maxLength={c.max} step={c.step}
                  min={c.tipo === 'number' || c.tipo === 'date' ? c.min : undefined} autoComplete={c.tipo === 'password' ? 'new-password' : 'off'}
                  value={valores[c.n]} onChange={(e) => mudar(c.n, e.target.value)} />
              );
            }}
          </Campo>
        ))}
        <Acoes>
          <Botao type="submit" disabled={enviando}>{botao}</Botao>
          <Botao variante="sec" onClick={aoFechar}>Cancelar</Botao>
        </Acoes>
      </form>
    </Dialogo>
  );
}

// ---------- trilha de rastreio (o elemento de destaque do portal) ----------
export const ETAPAS = [
  ['Recebido', ['AGUARDANDO_TRIAGEM']],
  ['Triagem', ['EM_TRIAGEM']],
  ['Desmonte', ['AGUARDANDO_DESMONTE', 'EM_DESMONTE']],
  ['Destino', ['PECAS_REAPROVEITADAS', 'MATERIAL_RECICLAVEL', 'DESCARTE_SEGURO']],
  ['Baixa', ['BAIXA_DEFINITIVA']]
];

// Cada estação acende quando o equipamento já passou por ela. Em tela estreita a trilha fica vertical.
export function Trilha({ visitados, atual, escura, animada }) {
  const linhaOff = escura ? 'bg-[#2f4a3e]' : 'bg-linha';
  const linhaOn = escura ? 'bg-brilho' : 'bg-acao';
  return (
    <ol className="my-5 flex list-none flex-col p-0 sm:flex-row sm:items-start" aria-label="Etapas do equipamento">
      {ETAPAS.map(([nome, status], i) => {
        const feito = status.some((s) => visitados.has(s));
        const eAtual = status.includes(atual);
        const destino = status.find((s) => visitados.has(s));
        const ultimo = i === ETAPAS.length - 1;
        return (
          <li key={nome} style={{ '--i': i }} className={cx('relative min-w-0 pb-4 pl-9 text-[0.82rem] sm:flex-1 sm:pb-0 sm:pl-0 sm:pt-7 sm:text-center', feito ? (escura ? 'text-white' : 'text-tinta') : escura ? 'text-[#9bb3a6]' : 'text-suave', eAtual && 'font-semibold')}>
            {/* trilho que liga esta estação à seguinte */}
            {!ultimo && <span className={cx('absolute bottom-0 left-2 top-2 w-[3px] sm:bottom-auto sm:left-1/2 sm:right-[-50%] sm:top-[0.55rem] sm:h-[3px] sm:w-auto', feito ? linhaOn : linhaOff)} />}
            <span className={cx('absolute left-0 top-0 h-[18px] w-[18px] rounded-full border-[3px] sm:left-[calc(50%-9px)]', animada && 'acende', feito ? (escura ? 'border-brilho bg-brilho' : 'border-acao bg-acao') : cx(escura ? 'border-[#2f4a3e] bg-lateral' : 'border-linha bg-papel'), eAtual && 'shadow-[0_0_0_5px_color-mix(in_srgb,var(--acao)_25%,transparent)]')} />
            <span className="block px-1">{nome}</span>
            {feito && nome === 'Destino' && destino && <span className="block px-1 text-suave">{rotulo(STATUS, destino)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

// Alves aprova este código.
