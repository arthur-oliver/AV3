import { useState } from 'react';
import { ESTADOS, TIPOS } from '../lib/rotulos.js';
import { Botao, Entrada, Seletor } from './ui.jsx';

const nova = (n) => ({ k: n, tipo: 'COMPUTADOR_MESA', marca: '', modelo: '', ano: String(new Date().getFullYear() - 3), estado: 'USADO_LEVE', peso: '' });

// Estado e editor das linhas de equipamento (registro de lote e "adicionar equipamentos").
export function useLinhasEquip() {
  const [linhas, setLinhas] = useState([nova(1)]);
  const [prox, setProx] = useState(2);
  return {
    linhas,
    adicionar: () => { setLinhas((l) => [...l, nova(prox)]); setProx(prox + 1); },
    remover: (k) => setLinhas((l) => l.filter((x) => x.k !== k)),
    mudar: (k, campo, valor) => setLinhas((l) => l.map((x) => (x.k === k ? { ...x, [campo]: valor } : x))),
    reiniciar: () => { setLinhas([nova(prox)]); setProx(prox + 1); },
    valores: () => linhas.map((l) => ({ tipo: l.tipo, marca: l.marca || undefined, modelo: l.modelo || undefined, anoFabricacao: Number(l.ano), estadoFisico: l.estado, pesoQuilogramas: Number(l.peso) }))
  };
}

const Rot = ({ children }) => <span className="mb-1 block text-[0.85rem] text-suave">{children}</span>;

export function LinhasEquip({ estado }) {
  return (
    <div className="grid gap-3">
      {estado.linhas.map((l) => (
        <div key={l.k} className="grid items-end gap-2 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
          <label><Rot>Tipo</Rot><Seletor opcoes={TIPOS} value={l.tipo} onChange={(e) => estado.mudar(l.k, 'tipo', e.target.value)} /></label>
          <label><Rot>Marca</Rot><Entrada maxLength={80} value={l.marca} onChange={(e) => estado.mudar(l.k, 'marca', e.target.value)} /></label>
          <label><Rot>Modelo</Rot><Entrada maxLength={80} value={l.modelo} onChange={(e) => estado.mudar(l.k, 'modelo', e.target.value)} /></label>
          <label><Rot>Ano</Rot><Entrada type="number" min="1970" max="2100" required value={l.ano} onChange={(e) => estado.mudar(l.k, 'ano', e.target.value)} /></label>
          <label><Rot>Estado</Rot><Seletor opcoes={ESTADOS} value={l.estado} onChange={(e) => estado.mudar(l.k, 'estado', e.target.value)} /></label>
          <label><Rot>Peso (kg)</Rot><Entrada type="number" step="0.001" min="0.001" required value={l.peso} onChange={(e) => estado.mudar(l.k, 'peso', e.target.value)} /></label>
          <div><Botao variante="perigo" mini aria-label="Remover equipamento" disabled={estado.linhas.length === 1} onClick={() => estado.remover(l.k)}>Remover</Botao></div>
        </div>
      ))}
    </div>
  );
}

// Oliver passou por aqui.
