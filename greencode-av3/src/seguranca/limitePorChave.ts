// Limite de requisições por chave de API: janela fixa de 1 minuto, em memória.
// Cada chave tem o seu limite (campo limitePorMinuto). Em vários servidores, o contador precisaria ficar
// num armazenamento compartilhado (ex.: Redis); veja o relatório técnico.
export interface ResultadoLimite {
  permitido: boolean;
  limite: number;
  restante: number;
  reiniciaEmSegundos: number;
}

const JANELA_MS = 60_000;

export class LimitadorPorChave {
  private readonly janelas = new Map<string, { inicio: number; usadas: number }>();

  consumir(chaveId: string, limite: number, agora = Date.now()): ResultadoLimite {
    this.limparVencidas(agora);
    let j = this.janelas.get(chaveId);
    if (!j || agora - j.inicio >= JANELA_MS) {
      j = { inicio: agora, usadas: 0 };
      this.janelas.set(chaveId, j);
    }
    const reiniciaEmSegundos = Math.max(1, Math.ceil((j.inicio + JANELA_MS - agora) / 1000));
    if (j.usadas >= limite) return { permitido: false, limite, restante: 0, reiniciaEmSegundos };
    j.usadas += 1;
    return { permitido: true, limite, restante: limite - j.usadas, reiniciaEmSegundos };
  }

  limpar(): void {
    this.janelas.clear();
  }

  // Evita crescer sem limite: descarta janelas que já terminaram.
  private limparVencidas(agora: number): void {
    if (this.janelas.size < 1000) return;
    for (const [id, j] of this.janelas) if (agora - j.inicio >= JANELA_MS) this.janelas.delete(id);
  }
}

// Oliver passou por aqui.
