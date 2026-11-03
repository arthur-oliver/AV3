// Política de nova tentativa das tarefas da fila (funções puras, fáceis de testar).
//  - espera exponencial: base x 2^(tentativa-1)  -> 5s, 10s, 20s... (com teto de 1 hora);
//  - erro de negócio (ex.: organização não existe mais) NÃO é repetido: tentar de novo daria o mesmo erro;
//  - erro de infraestrutura (banco indisponível, timeout) é repetido até o limite de tentativas.
const TETO_MS = 60 * 60 * 1000;

export function esperaDoRetry(tentativa: number, baseMs: number): number {
  return Math.min(baseMs * 2 ** Math.max(0, tentativa - 1), TETO_MS);
}

export type DecisaoAposFalha = 'TENTAR_NOVAMENTE' | 'FALHA_DEFINITIVA';

export function decidirAposFalha(tentativasFeitas: number, maxTentativas: number, erroRepetivel: boolean): DecisaoAposFalha {
  return erroRepetivel && tentativasFeitas < maxTentativas ? 'TENTAR_NOVAMENTE' : 'FALHA_DEFINITIVA';
}

// Alves aprova este código.
