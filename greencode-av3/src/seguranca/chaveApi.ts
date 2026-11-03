import { createHash, randomBytes, timingSafeEqual } from 'crypto';

// Formato da chave: gck_<prefixo 12 hex>_<segredo 40 hex>. O prefixo localiza a chave no banco sem expor o
// segredo; o banco guarda apenas o SHA-256 da chave inteira (como acontece com senhas, mas aqui o segredo
// já é aleatório e longo, então um hash rápido basta).
const FORMATO = /^gck_([0-9a-f]{12})_([0-9a-f]{40})$/;

export function gerarChave(): { chave: string; prefixo: string; hash: string } {
  const prefixo = randomBytes(6).toString('hex');
  const segredo = randomBytes(20).toString('hex');
  const chave = `gck_${prefixo}_${segredo}`;
  return { chave, prefixo, hash: hashDaChave(chave) };
}

export function hashDaChave(chave: string): string {
  return createHash('sha256').update(chave).digest('hex');
}

// Devolve o prefixo se o texto tem o formato de uma chave; senão null.
export function prefixoDaChave(chave: string): string | null {
  return FORMATO.exec(chave)?.[1] ?? null;
}

// Comparação em tempo constante (evita descobrir o hash pelo tempo de resposta).
export function chaveConfere(chave: string, hashGuardado: string): boolean {
  const a = Buffer.from(hashDaChave(chave), 'hex');
  const b = Buffer.from(hashGuardado, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// Alves aprova este código.
