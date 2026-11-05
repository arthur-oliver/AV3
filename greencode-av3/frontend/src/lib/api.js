import { useSyncExternalStore } from 'react';

// ---------- pequeno "store" para estado compartilhado fora dos componentes ----------
function criarStore(inicial) {
  let valor = inicial;
  const ouvintes = new Set();
  return {
    obter: () => valor,
    definir(novo) {
      valor = typeof novo === 'function' ? novo(valor) : novo;
      ouvintes.forEach((f) => f());
    },
    assinar(f) {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    }
  };
}
const usar = (store) => useSyncExternalStore(store.assinar, store.obter);

// ---------- sessão (vale só enquanto a aba estiver aberta) ----------
const CHAVE_SESSAO = 'gc_sessao';
function lerSessao() {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) || 'null');
  } catch {
    return null;
  }
}
const sessaoStore = criarStore(lerSessao());
export const useSessao = () => usar(sessaoStore);
export const obterSessao = () => sessaoStore.obter();
export function definirSessao(s) {
  sessaoStore.definir(s);
  try {
    if (s) sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
    else sessionStorage.removeItem(CHAVE_SESSAO);
  } catch {
    /* sem armazenamento: a sessão só vive na memória */
  }
}
export const atualizarSessao = (parcial) => definirSessao({ ...obterSessao(), ...parcial });
export function sair() {
  definirSessao(null);
  limiteStore.definir(null);
  location.hash = '';
}

// ---------- limite de requisições da chave de API (cabeçalhos X-RateLimit-*) ----------
const limiteStore = criarStore(null);
export const useLimite = () => usar(limiteStore);

// ---------- avisos na tela ----------
const avisosStore = criarStore([]);
export const useAvisos = () => usar(avisosStore);
let contador = 0;
export function avisar(titulo, texto, tipo = 'ok') {
  const id = ++contador;
  avisosStore.definir((l) => [...l, { id, titulo, texto, tipo }]);
  setTimeout(() => avisosStore.definir((l) => l.filter((a) => a.id !== id)), tipo === 'erro' ? 9000 : 4500);
}
export const fecharAviso = (id) => avisosStore.definir((l) => l.filter((a) => a.id !== id));

// ---------- chamadas à API ----------
export const P = (c) => `/api/v1/public${c}`;
export const I = (c) => `/api/v1/internal${c}`;
export const A = (c) => `/api/v1/admin${c}`;

export class ErroApi extends Error {
  constructor(resposta, corpo) {
    super((corpo && corpo.mensagem) || `Falha ${resposta.status}`);
    this.status = resposta.status;
    this.codigo = corpo && corpo.erro;
  }
}

export async function chamar(caminho, { metodo = 'GET', corpo, bruto } = {}) {
  const sessao = obterSessao();
  const cabecalhos = {};
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (sessao && sessao.modo === 'parceiro') cabecalhos['X-API-Key'] = sessao.chave;
  if (sessao && sessao.modo === 'interno') cabecalhos.Authorization = `Bearer ${sessao.token}`;

  const r = await fetch(caminho, { method: metodo, headers: cabecalhos, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });

  const limite = r.headers.get('X-RateLimit-Limit');
  if (limite) limiteStore.definir({ limite: Number(limite), restante: Number(r.headers.get('X-RateLimit-Remaining')) });

  if (!r.ok) {
    const json = await r.json().catch(() => null);
    const erro = new ErroApi(r, json);
    if (sessao && sessao.modo === 'interno' && !caminho.endsWith('/auth/login')) {
      if (r.status === 401) sair(); // token vencido ou usuário desativado
      // A senha foi redefinida por um administrador enquanto a pessoa estava logada: cai na tela de troca.
      if (r.status === 403 && erro.codigo === 'TROCA_SENHA_OBRIGATORIA') atualizarSessao({ trocaPendente: true });
    }
    throw erro;
  }
  if (bruto) return r;
  const texto = await r.text();
  return { dados: texto ? JSON.parse(texto) : null, total: Number(r.headers.get('X-Total-Count') || 0) };
}

// Chama algo e mostra o erro na tela em vez de estourar. Devolve o resultado ou null.
export async function seguro(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e.codigo === 'TROCA_SENHA_OBRIGATORIA') return null; // a tela de troca de senha assume
    const dica = e.codigo === 'LIMITE_DA_CHAVE' ? ' Aguarde alguns segundos e tente de novo.' : '';
    avisar('Não foi possível concluir', (e.message || 'Erro inesperado.') + dica, 'erro');
    return null;
  }
}

export async function baixar(caminho, nomePadrao) {
  const r = await seguro(() => chamar(caminho, { bruto: true }));
  if (!r) return;
  const m = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '');
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = m ? m[1] : nomePadrao;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Arthur Oliver Rossi Alves, autor do Greencode.
