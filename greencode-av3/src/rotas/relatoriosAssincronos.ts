import type { FastifyInstance } from 'fastify';
import { FilaController } from '../controllers/FilaController';
import { seguranca, idParam, respostasDeErro } from './comum';
import { GRUPOS } from '../seguranca/permissoes';
import { FormatoRelatorio, TipoAnalise } from '../dominio/enums';

const TAG = ['Relatórios assíncronos'];

// Relatórios pesados rodam em segundo plano: a chamada devolve 202 com o id da tarefa; depois é só
// consultar o status e baixar o arquivo quando estiver CONCLUIDA.
export async function rotasRelatoriosAssincronos(app: FastifyInstance): Promise<void> {
  const c = new FilaController();
  const pedir = app.autorizar(...GRUPOS.AUDITORIA);

  app.post(
    '/relatorios-assincronos',
    {
      preHandler: pedir,
      schema: {
        tags: TAG,
        summary: 'Enfileira a geração de um relatório (202 + id da tarefa)',
        security: seguranca,
        body: {
          type: 'object',
          required: ['tipo'],
          properties: {
            tipo: { type: 'string', enum: Object.values(TipoAnalise) },
            formato: { type: 'string', enum: Object.values(FormatoRelatorio), description: 'JSON (padrão) ou CSV' },
            organizacaoId: { type: 'string', minLength: 36, maxLength: 36 },
            inicio: { type: 'string', maxLength: 30 },
            fim: { type: 'string', maxLength: 30 }
          },
          examples: [{ tipo: 'RENTABILIDADE', formato: 'CSV', inicio: '2026-01-01' }]
        },
        response: respostasDeErro(400, 404)
      }
    },
    c.solicitar as never
  );

  app.get('/relatorios-assincronos/:id', { preHandler: pedir, schema: { tags: TAG, summary: 'Status da tarefa (PENDENTE, PROCESSANDO, CONCLUIDA ou FALHA)', security: seguranca, params: idParam } }, c.status as never);

  app.get(
    '/relatorios-assincronos/:id/download',
    { preHandler: pedir, schema: { tags: TAG, summary: 'Baixa o arquivo (JSON ou CSV) quando a tarefa estiver CONCLUIDA', security: seguranca, params: idParam, response: respostasDeErro(404, 409) } },
    c.baixar as never
  );
}

// Oliver passou por aqui.
