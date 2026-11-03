import { config } from '../config';
import { FilaServico } from '../servicos/FilaServico';
import type { PortaFila } from '../servicos/FilaServico';
import { ProcessadorRelatorio } from './ProcessadorRelatorio';
import type { SaidaRelatorio, TarefaParaProcessar } from './ProcessadorRelatorio';

interface Log {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

interface Executor {
  processar(t: TarefaParaProcessar): Promise<SaidaRelatorio>;
}

const MAX_POR_CICLO = 20;
const RECUPERAR_A_CADA_MS = 60_000;

// Worker da fila: a cada WORKER_INTERVALO_MS pega tarefas PENDENTE e as processa uma a uma, no mesmo processo
// da API. Para escalar, basta subir outras instâncias: a reivindicação atômica no banco impede duplicidade.
export class TarefaWorker {
  private timer: NodeJS.Timeout | null = null;
  private ocupado = false;
  private ultimaRecuperacao = 0;

  constructor(
    private readonly log: Log,
    private readonly fila: PortaFila = new FilaServico(),
    private readonly executor: Executor = new ProcessadorRelatorio()
  ) {}

  iniciar(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.ciclo(), config.workerIntervaloMs);
    this.timer.unref(); // o timer sozinho não impede o processo de encerrar
    this.log.info(`Worker da fila iniciado (a cada ${config.workerIntervaloMs} ms).`);
  }

  // Um ciclo: recupera tarefas travadas (no máximo 1x por minuto) e processa o que estiver pendente.
  async ciclo(): Promise<number> {
    if (this.ocupado) return 0;
    this.ocupado = true;
    let processadas = 0;
    try {
      if (Date.now() - this.ultimaRecuperacao > RECUPERAR_A_CADA_MS) {
        this.ultimaRecuperacao = Date.now();
        const n = await this.fila.recuperarTravadas();
        if (n > 0) this.log.info(`${n} tarefa(s) travada(s) devolvida(s) à fila.`);
      }
      while (processadas < MAX_POR_CICLO && (await this.processarUma())) processadas += 1;
    } catch (erro) {
      this.log.error(`Falha no ciclo do worker: ${erro instanceof Error ? erro.message : String(erro)}`);
    } finally {
      this.ocupado = false;
    }
    return processadas;
  }

  // Pega a próxima tarefa e a executa. Devolve false quando a fila está vazia.
  async processarUma(): Promise<boolean> {
    const tarefa = await this.fila.reivindicarProxima();
    if (!tarefa) return false;
    try {
      const saida = await this.executor.processar(tarefa);
      await this.fila.concluir(tarefa.id, saida);
    } catch (erro) {
      this.log.error(`Tarefa ${tarefa.id} falhou (tentativa ${tarefa.tentativas}/${tarefa.maxTentativas}): ${erro instanceof Error ? erro.message : String(erro)}`);
      await this.fila.registrarFalha(tarefa, erro);
    }
    return true;
  }

  // Encerramento limpo: para o timer e espera o ciclo em andamento terminar (até 10 s).
  async parar(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (let i = 0; i < 100 && this.ocupado; i++) await new Promise((r) => setTimeout(r, 100));
  }
}

// Alves aprova este código.
