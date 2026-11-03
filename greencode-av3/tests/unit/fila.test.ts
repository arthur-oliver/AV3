import { describe, expect, it } from 'vitest';
import { decidirAposFalha, esperaDoRetry } from '../../src/regras/retry';

describe('política de retry', () => {
  it('a espera dobra a cada tentativa (backoff exponencial) e tem teto de 1 hora', () => {
    expect(esperaDoRetry(1, 5000)).toBe(5000);
    expect(esperaDoRetry(2, 5000)).toBe(10000);
    expect(esperaDoRetry(3, 5000)).toBe(20000);
    expect(esperaDoRetry(30, 5000)).toBe(3_600_000);
  });

  it('repete erros de infraestrutura até o limite; erro de negócio falha de vez', () => {
    expect(decidirAposFalha(1, 3, true)).toBe('TENTAR_NOVAMENTE');
    expect(decidirAposFalha(2, 3, true)).toBe('TENTAR_NOVAMENTE');
    expect(decidirAposFalha(3, 3, true)).toBe('FALHA_DEFINITIVA');
    expect(decidirAposFalha(1, 3, false)).toBe('FALHA_DEFINITIVA');
  });
});

// Fila e executor falsos: testam o worker sem banco de dados.
async function montar(ids: string[], falhar: string[] = []) {
  // O worker lê a configuração (config.ts), que exige estas variáveis; valores de mentira bastam, não há banco aqui.
  process.env.DATABASE_URL ??= 'mysql://teste:teste@localhost:3306/teste';
  process.env.JWT_SECRET ??= 'segredo-somente-para-testes-unitarios-com-32-caracteres';
  const { TarefaWorker } = await import('../../src/fila/TarefaWorker');
  const pendentes = ids.map((id) => ({ id, tentativas: 1, maxTentativas: 3 }));
  const concluidas: string[] = [];
  const falhas: { id: string; erro: unknown }[] = [];
  let travadasDevolvidas = 0;
  const fila = {
    reivindicarProxima: async () => (pendentes.shift() as never) ?? null,
    concluir: async (id: string) => void concluidas.push(id),
    registrarFalha: async (t: { id: string }, erro: unknown) => void falhas.push({ id: t.id, erro }),
    recuperarTravadas: async () => ++travadasDevolvidas
  };
  const executor = {
    processar: async (t: { id: string }) => {
      if (falhar.includes(t.id)) throw new Error(`erro em ${t.id}`);
      return { conteudo: '{}', tipoConteudo: 'application/json', nomeArquivo: `${t.id}.json`, tamanhoBytes: 2 };
    }
  };
  const log = { info: () => undefined, error: () => undefined };
  return { worker: new TarefaWorker(log, fila as never, executor as never), concluidas, falhas, pendentes, travadas: () => travadasDevolvidas };
}

describe('worker da fila', () => {
  it('fila vazia: nada a fazer', async () => {
    const { worker } = await montar([]);
    expect(await worker.processarUma()).toBe(false);
    expect(await worker.ciclo()).toBe(0);
  });

  it('processa todas as tarefas pendentes em um ciclo', async () => {
    const { worker, concluidas, pendentes } = await montar(['t1', 't2', 't3']);
    expect(await worker.ciclo()).toBe(3);
    expect(concluidas).toEqual(['t1', 't2', 't3']);
    expect(pendentes).toHaveLength(0);
  });

  it('uma tarefa que falha é registrada para retry e não impede as outras', async () => {
    const { worker, concluidas, falhas } = await montar(['t1', 't2', 't3'], ['t2']);
    expect(await worker.ciclo()).toBe(3);
    expect(concluidas).toEqual(['t1', 't3']);
    expect(falhas).toHaveLength(1);
    expect(falhas[0].id).toBe('t2');
  });

  it('recupera tarefas travadas no começo do ciclo', async () => {
    const { worker, travadas } = await montar([]);
    await worker.ciclo();
    expect(travadas()).toBe(1);
  });

  it('não roda dois ciclos ao mesmo tempo', async () => {
    const { worker } = await montar(['t1']);
    const primeiro = worker.ciclo();
    expect(await worker.ciclo()).toBe(0); // segundo chamado enquanto o primeiro ainda roda
    expect(await primeiro).toBe(1);
  });
});

// Arthur Oliver Rossi Alves, autor do Greencode.
