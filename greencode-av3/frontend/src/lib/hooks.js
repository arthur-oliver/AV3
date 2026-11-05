import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { seguro } from './api.js';

// ---------- rota pelo "#" da URL: #/lotes/123 -> { rota: 'lotes', id: '123' } ----------
const assinarHash = (f) => {
  window.addEventListener('hashchange', f);
  return () => window.removeEventListener('hashchange', f);
};
const lerHash = () => location.hash;
export function useRota() {
  const hash = useSyncExternalStore(assinarHash, lerHash);
  const [rota = '', id = ''] = hash.replace(/^#\//, '').split('/');
  return { rota, id };
}
export const ir = (caminho) => {
  location.hash = `#/${caminho}`;
};

// ---------- carrega dados e refaz quando as dependências mudam ----------
// buscar() devolve { dados, total } (resposta de chamar) ou um valor qualquer; erros viram aviso na tela.
export function useCarregar(buscar, deps = []) {
  const [estado, setEstado] = useState({ carregando: true, resultado: null });
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let ativo = true;
    setEstado((e) => ({ ...e, carregando: true }));
    seguro(buscar).then((resultado) => {
      if (ativo) setEstado({ carregando: false, resultado });
    });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, versao]);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { ...estado, dados: estado.resultado ? estado.resultado.dados : null, total: estado.resultado ? estado.resultado.total : 0, recarregar };
}

// ---------- lista paginada ----------
export function usePaginada(buscar, deps = [], tamanho = 15) {
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), deps); // eslint-disable-line react-hooks/exhaustive-deps
  const r = useCarregar(() => buscar(pagina, tamanho), [pagina, ...deps]);
  return { ...r, pagina, setPagina, tamanho, ultima: Math.max(1, Math.ceil(r.total / tamanho)) };
}

// Oliver passou por aqui.
