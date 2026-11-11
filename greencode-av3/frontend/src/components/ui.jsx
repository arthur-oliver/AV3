import { useEffect, useId, useRef, useState } from 'react';
import { usePaginada } from '../lib/hooks.js';
import { rotulo, STATUS } from '../lib/rotulos.js';

const cx = (...c) => c.filter(Boolean).join(' ');

// ---------- botões e campos ----------
// Botões em caixa alta, borda grossa e sombra sólida que "afunda" ao clicar.
const BOTAO = {
  primario: 'border-linha bg-acao text-white hover:bg-acao-escura',
  sec: 'border-linha bg-superficie text-tinta hover:bg-papel',
  perigo: 'border-erro bg-superficie text-erro hover:bg-erro hover:text-white'
};
export function Botao({ variante = 'primario', mini, className, type = 'button', ...resto }) {
  return (
    <button
      type={type}
      className={cx(
        'cursor-pointer border-2 font-mono font-semibold uppercase tracking-wider shadow-[3px_3px_0_var(--sombra)] transition-[translate,box-shadow] duration-100 hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_var(--sombra)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:translate-x-0 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none',
        mini ? 'px-2 py-0.5 text-[0.72rem]' : 'px-5 py-2.5 text-[0.82rem]',
        BOTAO[variante],
        className
      )}
      {...resto}
    />
  );
}

export const CLASSE_CAMPO = 'w-full border-0 border-b-[3px] border-linha bg-papel px-3 py-2.5 text-tinta focus:border-acao focus:bg-superficie';
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
    <div className={cx('mb-4', className)}>
      <label htmlFor={id} className="mb-1.5 block font-mono text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-suave">{texto}</label>
      {typeof children === 'function' ? children(id) : children}
      {dica && <p className="mt-1.5 border-l-2 border-sinal pl-2 text-[0.82rem] text-suave">{dica}</p>}
    </div>
  );
}
export const LinhaCampos = ({ children }) => <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">{children}</div>;
export const Acoes = ({ children, className }) => <div className={cx('mt-3 flex flex-wrap items-center gap-3', className)}>{children}</div>;

// ---------- estrutura ----------
// Título grande em caixa alta à esquerda, texto de apoio em fonte mono à direita.
export function Cabeca({ titulo, texto, id }) {
  return (
    <header className="mb-8 grid gap-3 border-b-[3px] border-linha pb-5 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-end">
      <h1 id={id} className="m-0 font-titulo text-[clamp(2.1rem,4.5vw,3.4rem)] font-bold uppercase leading-[0.95] tracking-[-0.04em]">
        <span aria-hidden="true" className="mb-3 block h-2 w-16 bg-acao" />
        {titulo}
      </h1>
      {texto && <p className="m-0 max-w-[60ch] font-mono text-[0.86rem] text-suave md:justify-self-end md:text-right">{texto}</p>}
    </header>
  );
}
export const H2 = ({ children, className }) => <h2 className={cx('mb-4 mt-10 w-fit bg-tinta px-3 py-1 font-titulo text-[1.05rem] font-bold uppercase tracking-[0.06em] text-papel', className)}>{children}</h2>;
export const H3 = ({ children, className }) => <h3 className={cx('mb-2 mt-6 w-fit border-b-2 border-acao pb-0.5 font-mono text-[0.9rem] font-semibold uppercase tracking-[0.1em]', className)}>{children}</h3>;
export const Painel = ({ children, className, ...p }) => <div className={cx('mb-6 border-2 border-linha bg-superficie p-5 shadow-[6px_6px_0_var(--sombra)]', className)} {...p}>{children}</div>;
export const Suave = ({ children, className }) => <p className={cx('font-mono text-[0.82rem] text-suave', className)}>{children}</p>;
export const Vazio = ({ children }) => <p className="border-2 border-dashed border-suave px-4 py-6 text-center font-mono text-[0.85rem] text-suave">{children}</p>;
export const Carregando = () => <p className="py-3 font-mono text-[0.85rem] uppercase tracking-widest text-sinal">Carregando...</p>;
export const Voltar = ({ para, children }) => (
  <p className="mb-5">
    <a className="inline-block border-2 border-linha bg-superficie px-3 py-1 font-mono text-[0.78rem] font-semibold uppercase tracking-wider text-tinta no-underline hover:bg-tinta hover:text-papel" href={`#/${para}`}>
      <span aria-hidden="true">← </span>{children}
    </a>
  </p>
);

const SELO = { ok: 'bg-ok text-white', erro: 'bg-erro text-white', andamento: 'bg-sinal text-white', '': 'bg-papel text-tinta outline outline-1 outline-linha' };
export const Selo = ({ tipo = '', children }) => <span className={cx('inline-block whitespace-nowrap px-2 py-0.5 font-mono text-[0.7rem] font-semibold uppercase tracking-wider', SELO[tipo])}>{children}</span>;
export const SeloStatus = ({ status }) => <Selo>{rotulo(STATUS, status)}</Selo>;

// Indicadores em blocos soltos; o primeiro vai em destaque.
export function Indicadores({ itens }) {
  return (
    <dl className="my-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
      {itens.map(([titulo, valor], i) => (
        <div key={titulo} className={cx('border-2 border-linha p-4 shadow-[4px_4px_0_var(--sombra)]', i === 0 ? 'bg-acao text-white' : 'bg-superficie')}>
          <dt className={cx('font-mono text-[0.7rem] font-semibold uppercase tracking-[0.14em]', i === 0 ? 'text-white/85' : 'text-suave')}>{titulo}</dt>
          <dd className="m-0 mt-2 break-words font-titulo text-[1.7rem] font-bold leading-tight tracking-tight">{valor}</dd>
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
    <div className="overflow-x-auto border-2 border-linha bg-superficie shadow-[6px_6px_0_var(--sombra)]">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {colunas.map((c, i) => (
              <th key={i} className={cx('bg-tinta px-3 py-2.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-papel', c.num && 'text-right')}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr
              key={l.id || i}
              className={cx('border-b border-linha/15 align-top even:bg-papel/70', aoClicar && 'cursor-pointer hover:bg-acao/15 focus-visible:bg-acao/15')}
              tabIndex={aoClicar ? 0 : undefined}
              onClick={aoClicar ? () => aoClicar(l) : undefined}
              onKeyDown={aoClicar ? (ev) => ev.key === 'Enter' && aoClicar(l) : undefined}
            >
              {colunas.map((c, j) => (
                <td key={j} className={cx('px-3 py-2.5', c.num && 'text-right font-mono tabular-nums')}>{c.ver(l)}</td>
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
    <span className="inline-flex items-center gap-2 font-mono">
      <span className={cx('inline-block h-3.5 border border-linha', negativo ? 'bg-erro' : 'bg-sinal')} style={{ width: `${largura}px` }} />
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
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 font-mono text-[0.78rem] uppercase tracking-wider">
        <Botao variante="sec" mini disabled={p.pagina <= 1} onClick={() => p.setPagina(p.pagina - 1)}>Anterior</Botao>
        <span className="border-2 border-linha bg-superficie px-3 py-0.5">Página {p.pagina} de {p.ultima} ({p.total} no total)</span>
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
      className="m-auto max-h-[calc(100vh-2rem)] w-[min(600px,calc(100vw-2rem))] overflow-auto border-[3px] border-linha bg-superficie p-0 text-tinta shadow-[10px_10px_0_var(--sombra)]"
    >
      <h2 className="m-0 mb-5 bg-acao px-6 py-3 font-titulo text-[1.25rem] font-bold uppercase tracking-tight text-white">{titulo}</h2>
      <div className="px-6 pb-6">{children}</div>
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
              if (c.tipo === 'check') return <input id={id} type="checkbox" className="h-5 w-5 accent-[var(--acao)]" checked={valores[c.n]} onChange={(e) => mudar(c.n, e.target.checked)} />;
              if (c.linhas) return <AreaTexto id={id} rows={c.linhas} maxLength={c.max} required={c.req} value={valores[c.n]} onChange={(e) => mudar(c.n, e.target.value)} />;
              return (
                <Entrada id={id} type={c.tipo || 'text'} required={c.req} minLength={c.min} maxLength={c.max} step={c.step}
                  min={c.tipo === 'number' || c.tipo === 'date' ? c.min : undefined} autoComplete={c.tipo === 'password' ? 'new-password' : 'off'}
                  value={valores[c.n]} onChange={(e) => mudar(c.n, e.target.value)} />
              );
            }}
          </Campo>
        ))}
        <Acoes className="mt-6 flex-row-reverse justify-start">
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

// Trilha em blocos numerados: cada bloco se preenche quando o equipamento já passou pela etapa.
// Em tela estreita os blocos se empilham.
export function Trilha({ visitados, atual, escura, animada }) {
  return (
    <ol className="my-6 grid list-none gap-2 p-0 sm:grid-cols-5 sm:gap-0" aria-label="Etapas do equipamento">
      {ETAPAS.map(([nome, status], i) => {
        const feito = status.some((s) => visitados.has(s));
        const eAtual = status.includes(atual);
        const destino = status.find((s) => visitados.has(s));
        return (
          <li
            key={nome}
            style={{ '--i': i }}
            className={cx(
              'relative min-w-0 border-2 px-3 py-3 sm:[&:not(:first-child)]:-ml-[2px]',
              animada && 'acende',
              escura ? 'border-white' : 'border-linha',
              feito ? (escura ? 'bg-white text-tinta' : 'bg-acao text-white') : escura ? 'bg-transparent text-white/70' : 'bg-superficie text-suave',
              eAtual && 'z-10 outline outline-[3px] outline-offset-2 outline-sinal'
            )}
          >
            <span className="block font-mono text-[0.68rem] font-semibold tracking-[0.15em]">{String(i + 1).padStart(2, '0')}{eAtual ? ' · ATUAL' : ''}</span>
            <span className="block font-titulo text-[0.95rem] font-bold uppercase leading-tight">{nome}</span>
            {feito && nome === 'Destino' && destino && <span className="mt-1 block font-mono text-[0.7rem] opacity-85">{rotulo(STATUS, destino)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

// Alves aprova este código.
