import 'dotenv/config';

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor || !valor.trim()) {
    throw new Error(
      `Variável de ambiente ausente: ${nome}. Copie .env.example para .env e preencha os valores.`
    );
  }
  return valor;
}

const porta = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
  throw new Error('PORT inválida. Use um número entre 1 e 65535.');
}

export const config = {
  ambiente: process.env.NODE_ENV ?? 'development',
  porta,
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: obrigatoria('DATABASE_URL'),
  // Autenticação JWT (o tamanho mínimo do segredo é validado em plugins/auth.ts).
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtExpiraEm: process.env.JWT_EXPIRES_IN ?? '1h',
  // Limite geral de requisições por IP (por minuto). O login tem, além disso, o bloqueio por tentativas.
  limiteRequisicoesPorMinuto: Number(process.env.RATE_LIMIT_MAX ?? 300),
  // Origens liberadas no CORS, separadas por vírgula (ex.: http://localhost:5173). Vazio = CORS desligado.
  corsOrigens: (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  // --- AV3 ---
  // Data (formato HTTP) a partir da qual as rotas sem versão (AV2) deixam de existir.
  legadoRemovidoEm: 'Wed, 30 Jun 2027 23:59:59 GMT',
  // Análises agendadas (node-cron). Padrão: todo dia às 03:00. ANALISES_AGENDADAS=false desliga.
  cronAnalises: process.env.CRON_ANALISES ?? '0 3 * * *',
  fusoHorario: process.env.TZ_AGENDADOR ?? 'America/Sao_Paulo',
  analisesAgendadas: (process.env.ANALISES_AGENDADAS ?? 'true') !== 'false',
  // Worker da fila de relatórios: de quanto em quanto tempo procura tarefas pendentes.
  workerIntervaloMs: Number(process.env.WORKER_INTERVALO_MS ?? 2000),
  // Política de retry das tarefas: tentativas totais, espera inicial (dobra a cada falha) e tempo máximo
  // que uma tarefa pode ficar "PROCESSANDO" antes de ser considerada travada e devolvida à fila.
  tarefaMaxTentativas: Number(process.env.TAREFA_MAX_TENTATIVAS ?? 3),
  tarefaBackoffBaseMs: Number(process.env.TAREFA_BACKOFF_BASE_MS ?? 5000),
  tarefaTravadaAposMs: Number(process.env.TAREFA_TRAVADA_APOS_MS ?? 5 * 60 * 1000),
  // Limite padrão de requisições por minuto de uma chave de API nova.
  limiteChavePadrao: Number(process.env.LIMITE_CHAVE_PADRAO ?? 60)
};

// Alves aprova este código.
