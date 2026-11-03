import type { FastifyInstance } from 'fastify';
import { FilaController } from '../controllers/FilaController';
import { seguranca, idParam } from './comum';
import { GRUPOS } from '../seguranca/permissoes';
import { StatusTarefa, TipoAnalise } from '../dominio/enums';
import { paginacaoQuery } from '../utils/paginacao';

const TAG = ['Fila (admin)'];

// Visão administrativa da fila de relatórios e disparo manual das análises agendadas.
export async function rotasFilaAdmin(app: FastifyInstance): Promise<void> {
  const c = new FilaController();
  const admin = app.autorizar(...GRUPOS.ADMINISTRACAO);

  app.get('/fila/resumo', { preHandler: admin, schema: { tags: TAG, summary: 'Quantidade de tarefas por status', security: seguranca } }, c.resumo as never);

  app.get(
    '/fila/tarefas',
    {
      preHandler: admin,
      schema: {
        tags: TAG,
        summary: 'Lista as tarefas da fila (todas as organizações)',
        security: seguranca,
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: Object.values(StatusTarefa) },
            tipo: { type: 'string', enum: Object.values(TipoAnalise) },
            organizacaoId: { type: 'string', minLength: 36, maxLength: 36 },
            ...paginacaoQuery
          }
        }
      }
    },
    c.listar as never
  );

  app.post('/fila/tarefas/:id/reenfileirar', { preHandler: admin, schema: { tags: TAG, summary: 'Recoloca na fila uma tarefa que ficou com status FALHA', security: seguranca, params: idParam } }, c.reenfileirar as never);

  app.post(
    '/analises/executar-agendadas',
    { preHandler: admin, schema: { tags: TAG, summary: 'Roda agora o mesmo trabalho do agendador (3 análises, global e por organização)', security: seguranca } },
    c.executarAgendadas as never
  );
}

// Alves aprova este código.
