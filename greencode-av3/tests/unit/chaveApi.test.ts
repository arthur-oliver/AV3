import { describe, expect, it } from 'vitest';
import { chaveConfere, gerarChave, hashDaChave, prefixoDaChave } from '../../src/seguranca/chaveApi';
import { LimitadorPorChave } from '../../src/seguranca/limitePorChave';

describe('chave de API', () => {
  it('tem o formato gck_<12 hex>_<40 hex> e o prefixo coincide', () => {
    const { chave, prefixo, hash } = gerarChave();
    expect(chave).toMatch(/^gck_[0-9a-f]{12}_[0-9a-f]{40}$/);
    expect(prefixoDaChave(chave)).toBe(prefixo);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('cada chave é diferente e o hash não revela o segredo', () => {
    const a = gerarChave();
    const b = gerarChave();
    expect(a.chave).not.toBe(b.chave);
    expect(a.hash).not.toBe(b.hash);
    expect(a.hash).not.toContain(a.chave.slice(-40));
  });

  it('confere a chave correta e recusa a errada', () => {
    const { chave, hash } = gerarChave();
    expect(chaveConfere(chave, hash)).toBe(true);
    expect(chaveConfere(chave.slice(0, -1) + (chave.endsWith('0') ? '1' : '0'), hash)).toBe(false);
    expect(chaveConfere('qualquer-coisa', hash)).toBe(false);
    expect(hashDaChave(chave)).toBe(hash);
  });

  it('rejeita textos fora do formato', () => {
    expect(prefixoDaChave('')).toBeNull();
    expect(prefixoDaChave('gck_curta_abc')).toBeNull();
    expect(prefixoDaChave('xxx_' + 'a'.repeat(12) + '_' + 'b'.repeat(40))).toBeNull();
  });
});

describe('limite de requisições por chave', () => {
  it('libera até o limite e bloqueia a partir daí, informando o tempo de espera', () => {
    const l = new LimitadorPorChave();
    const t0 = 1_000_000;
    expect(l.consumir('k1', 3, t0)).toMatchObject({ permitido: true, restante: 2, limite: 3 });
    expect(l.consumir('k1', 3, t0 + 1000)).toMatchObject({ permitido: true, restante: 1 });
    expect(l.consumir('k1', 3, t0 + 2000)).toMatchObject({ permitido: true, restante: 0 });
    const negado = l.consumir('k1', 3, t0 + 3000);
    expect(negado.permitido).toBe(false);
    expect(negado.reiniciaEmSegundos).toBe(57);
  });

  it('cada chave tem a sua contagem e a janela reinicia após 1 minuto', () => {
    const l = new LimitadorPorChave();
    const t0 = 5_000_000;
    l.consumir('a', 1, t0);
    expect(l.consumir('a', 1, t0 + 10).permitido).toBe(false);
    expect(l.consumir('b', 1, t0 + 10).permitido).toBe(true);
    expect(l.consumir('a', 1, t0 + 60_000).permitido).toBe(true);
  });
});

// Oliver passou por aqui.
