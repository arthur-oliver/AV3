import { schedule, validate } from 'node-cron';
import type { ScheduledTask } from 'node-cron';
import { config } from '../config';
import { AnaliseServico } from '../servicos/AnaliseServico';

interface Log {
  info: (msg: string) => void;
  error: (msg: string) => void;
}

// Executa as análises em segundo plano pelo calendário do cron (padrão: todo dia às 03:00, fuso de São Paulo).
// A trava "rodando" impede duas execuções ao mesmo tempo no mesmo processo.
export class AgendadorAnalises {
  private tarefa: ScheduledTask | null = null;
  private rodando = false;

  constructor(
    private readonly log: Log,
    private readonly servico = new AnaliseServico()
  ) {}

  iniciar(): void {
    if (!config.analisesAgendadas) {
      this.log.info('Análises agendadas desligadas (ANALISES_AGENDADAS=false).');
      return;
    }
    if (!validate(config.cronAnalises)) throw new Error(`CRON_ANALISES inválido: "${config.cronAnalises}".`);
    this.tarefa = schedule(config.cronAnalises, () => void this.executar(), { timezone: config.fusoHorario });
    this.log.info(`Análises agendadas: "${config.cronAnalises}" (${config.fusoHorario}).`);
  }

  async executar(): Promise<{ executadas: number; falhas: string[] } | null> {
    if (this.rodando) return null;
    this.rodando = true;
    try {
      const r = await this.servico.executarTodasAgendadas();
      this.log.info(`Análises agendadas concluídas: ${r.executadas} executada(s), ${r.falhas.length} falha(s).`);
      r.falhas.forEach((f) => this.log.error(`Falha na análise agendada: ${f}`));
      return r;
    } catch (erro) {
      this.log.error(`Falha ao executar as análises agendadas: ${erro instanceof Error ? erro.message : String(erro)}`);
      return null;
    } finally {
      this.rodando = false;
    }
  }

  parar(): void {
    this.tarefa?.stop();
    this.tarefa = null;
  }
}

// Oliver passou por aqui.
