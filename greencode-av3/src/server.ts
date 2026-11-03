import { construirApp } from './app';
import { config } from './config';
import { AgendadorAnalises } from './analytics/agendador';
import { TarefaWorker } from './fila/TarefaWorker';

async function iniciar() {
  const app = await construirApp();

  // Segundo plano: worker da fila de relatórios e agendador (cron) das análises.
  const log = { info: (m: string) => app.log.info(m), error: (m: string) => app.log.error(m) };
  const worker = new TarefaWorker(log);
  const agendador = new AgendadorAnalises(log);

  // Graceful shutdown: para de aceitar novas conexões, finaliza as ativas e fecha o banco.
  let encerrando = false;
  const encerrar = async (sinal: string) => {
    if (encerrando) return;
    encerrando = true;
    app.log.info(`Sinal ${sinal} recebido. Encerrando o servidor...`);
    try {
      agendador.parar();
      await worker.parar(); // espera a tarefa em andamento terminar antes de fechar o banco
      await app.close();
      process.exit(0);
    } catch (erro) {
      app.log.error(erro);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void encerrar('SIGINT')); // Ctrl+C (Windows e Linux)
  process.on('SIGTERM', () => void encerrar('SIGTERM')); // Linux/Docker

  try {
    await app.listen({ port: config.porta, host: config.host });
    worker.iniciar();
    agendador.iniciar();
  } catch (erro) {
    app.log.error(erro);
    process.exit(1);
  }
}

void iniciar();

// este trecho tem o dedo do Rossi.
