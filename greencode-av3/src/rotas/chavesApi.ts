import type { FastifyInstance } from 'fastify';
import { ChaveApiController } from '../controllers/ChaveApiController';
import { seguranca, idParam, versao } from './comum';
import { GRUPOS } from '../seguranca/permissoes';
import { PermissaoApi } from '../dominio/enums';
import { paginacaoQuery } from '../utils/paginacao';

const TAG = ['Chaves de API'];
const permissoes = { type: 'array', items: { type: 'string', enum: Object.values(PermissaoApi) }, minItems: 1, uniqueItems: true };
const uuid = { type: 'string', minLength: 36, maxLength: 36 };

// Gestão das chaves dos parceiros (admin). A chave completa só aparece na criação e na rotação.
export async function rotasChavesApi(app: FastifyInstance): Promise<void> {
  const c = new ChaveApiController();
  const admin = app.autorizar(...GRUPOS.ADMINISTRACAO);

  app.post(
    '/chaves-api',
    {
      preHandler: admin,
      schema: {
        tags: TAG,
        summary: 'Cria uma chave de API para uma organização parceira (a chave aparece uma única vez)',
        security: seguranca,
        body: {
          type: 'object',
          required: ['nome', 'organizacaoId', 'permissoes'],
          properties: {
            nome: { type: 'string', minLength: 3, maxLength: 120 },
            organizacaoId: uuid,
            permissoes,
            limitePorMinuto: { type: 'integer', minimum: 1, maximum: 10000 },
            expiraEm: { type: 'string', maxLength: 30 }
          },
          examples: [{ nome: 'ERP da Tech Solutions', organizacaoId: '00000000-0000-4000-8000-0000000000a1', permissoes: ['LER_RASTREABILIDADE', 'LER_RELATORIOS'], limitePorMinuto: 120 }]
        }
      }
    },
    c.criar as never
  );

  app.get(
    '/chaves-api',
    {
      preHandler: admin,
      schema: { tags: TAG, summary: 'Lista as chaves (sem o segredo)', security: seguranca, querystring: { type: 'object', properties: { organizacaoId: uuid, ativa: { type: 'boolean' }, ...paginacaoQuery } } }
    },
    c.listar as never
  );

  app.get('/chaves-api/:id', { preHandler: admin, schema: { tags: TAG, summary: 'Detalha uma chave', security: seguranca, params: idParam } }, c.buscar as never);

  app.put(
    '/chaves-api/:id',
    {
      preHandler: admin,
      schema: {
        tags: TAG,
        summary: 'Altera nome, permissões, limite ou validade. Exige a "versao"',
        security: seguranca,
        params: idParam,
        body: {
          type: 'object',
          required: ['versao'],
          properties: { nome: { type: 'string', minLength: 3, maxLength: 120 }, permissoes, limitePorMinuto: { type: 'integer', minimum: 1, maximum: 10000 }, expiraEm: { type: 'string', maxLength: 30 }, versao }
        }
      }
    },
    c.atualizar as never
  );

  app.patch(
    '/chaves-api/:id/ativa',
    {
      preHandler: admin,
      schema: {
        tags: TAG,
        summary: 'Revoga (ativa=false) ou reativa a chave. Revogada, ela é recusada na hora',
        security: seguranca,
        params: idParam,
        body: { type: 'object', required: ['ativa', 'versao'], properties: { ativa: { type: 'boolean' }, versao } }
      }
    },
    c.alterarAtiva as never
  );

  app.post(
    '/chaves-api/:id/rotacionar',
    {
      preHandler: admin,
      schema: { tags: TAG, summary: 'Gera um segredo novo (o anterior deixa de valer). A nova chave aparece uma única vez', security: seguranca, params: idParam, body: { type: 'object', required: ['versao'], properties: { versao } } }
    },
    c.rotacionar as never
  );
}

// este trecho tem o dedo do Rossi.
