import type { FastifyInstance } from 'fastify';
import { AnaliseController } from '../controllers/AnaliseController';
import { seguranca, idParam } from './comum';
import { GRUPOS } from '../seguranca/permissoes';
import { TipoAnalise } from '../dominio/enums';
import { paginacaoQuery } from '../utils/paginacao';

const TAG = ['Análises'];
const tipoParam = {
  type: 'object',
  required: ['tipo'],
  properties: { tipo: { type: 'string', enum: Object.values(TipoAnalise), description: 'EFICIENCIA, RENTABILIDADE ou VIDA_UTIL' } }
};
const uuid = { type: 'string', minLength: 36, maxLength: 36 };

// Camada analítica (rotas internas): calcular, consultar a última e ver o histórico.
export async function rotasAnalises(app: FastifyInstance): Promise<void> {
  const c = new AnaliseController();
  const leitura = app.autorizar(...GRUPOS.AUDITORIA);

  app.post(
    '/analises/:tipo/executar',
    {
      preHandler: leitura,
      schema: {
        tags: TAG,
        summary: 'Calcula a análise agora e guarda o resultado no histórico',
        description:
          'EFICIENCIA e RENTABILIDADE usam por padrão os últimos 90 dias; VIDA_UTIL usa todo o histórico. ' +
          'Sem organizacaoId, a análise considera todas as organizações.',
        security: seguranca,
        params: tipoParam,
        body: {
          type: 'object',
          properties: { organizacaoId: uuid, inicio: { type: 'string', maxLength: 30 }, fim: { type: 'string', maxLength: 30 } },
          examples: [{ inicio: '2026-01-01', fim: '2026-06-30' }]
        }
      }
    },
    c.executar as never
  );

  app.get(
    '/analises/:tipo/ultima',
    {
      preHandler: leitura,
      schema: {
        tags: TAG,
        summary: 'Última análise guardada do tipo (calcula na hora se ainda não existir)',
        security: seguranca,
        params: tipoParam,
        querystring: { type: 'object', properties: { organizacaoId: uuid } }
      }
    },
    c.ultima as never
  );

  app.get(
    '/analises/historico',
    {
      preHandler: leitura,
      schema: {
        tags: TAG,
        summary: 'Histórico de análises calculadas (mais recentes primeiro)',
        security: seguranca,
        querystring: {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: Object.values(TipoAnalise) },
            organizacaoId: uuid,
            global: { type: 'boolean', description: 'true: só as análises de todas as organizações' },
            ...paginacaoQuery
          }
        }
      }
    },
    c.historico as never
  );

  app.get('/analises/historico/:id', { preHandler: leitura, schema: { tags: TAG, summary: 'Detalha uma análise do histórico', security: seguranca, params: idParam } }, c.buscar as never);
}

// Arthur Oliver Rossi Alves, autor do Greencode.
