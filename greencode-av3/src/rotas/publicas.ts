import type { FastifyInstance } from 'fastify';
import { PublicoController } from '../controllers/PublicoController';
import { idParam, respostasDeErro, segurancaChave } from './comum';
import { itemEquipamento } from './lotes';
import { FormatoRelatorio, PermissaoApi as P, StatusLote, TipoAnalise } from '../dominio/enums';
import { paginacaoQuery } from '../utils/paginacao';

const TAG_CONTA = ['Público - Conta'];
const TAG_LOTES = ['Público - Lotes'];
const TAG_RASTREIO = ['Público - Rastreabilidade'];
const TAG_ANALISES = ['Público - Análises'];
const TAG_RELATORIOS = ['Público - Relatórios'];

const tipoParam = { type: 'object', required: ['tipo'], properties: { tipo: { type: 'string', enum: Object.values(TipoAnalise) } } };

// API PÚBLICA (v1) para parceiros. Autenticação por chave (cabeçalho X-API-Key), com permissões e limite por
// requisições/minuto próprios de cada chave. Cada chave só enxerga os dados da sua organização.
export async function rotasPublicas(app: FastifyInstance): Promise<void> {
  const c = new PublicoController();
  const apenasChave = app.exigirChave();
  const lerRastro = app.exigirChave(P.LER_RASTREABILIDADE);
  const escreverLotes = app.exigirChave(P.ESCREVER_LOTES);
  const lerRelatorios = app.exigirChave(P.LER_RELATORIOS);

  app.get(
    '/eu',
    { onRequest: apenasChave, schema: { tags: TAG_CONTA, summary: 'Mostra a quem pertence a chave usada e suas permissões', security: segurancaChave, response: respostasDeErro(401, 429) } },
    c.eu as never
  );

  app.get(
    '/lotes',
    {
      onRequest: lerRastro,
      schema: {
        tags: TAG_LOTES,
        summary: 'Lista os lotes da organização (permissão LER_RASTREABILIDADE)',
        security: segurancaChave,
        querystring: { type: 'object', properties: { status: { type: 'string', enum: Object.values(StatusLote) }, inicio: { type: 'string', maxLength: 30 }, fim: { type: 'string', maxLength: 30 }, ...paginacaoQuery } },
        response: respostasDeErro(401, 403, 429)
      }
    },
    c.listarLotes as never
  );

  app.get('/lotes/:id', { onRequest: lerRastro, schema: { tags: TAG_LOTES, summary: 'Detalha um lote da organização com seus equipamentos', security: segurancaChave, params: idParam, response: respostasDeErro(401, 403, 404, 429) } }, c.buscarLote as never);

  app.post(
    '/lotes',
    {
      onRequest: escreverLotes,
      schema: {
        tags: TAG_LOTES,
        summary: 'Registra um lote da organização (permissão ESCREVER_LOTES)',
        security: segurancaChave,
        body: {
          type: 'object',
          required: ['notaFiscal', 'transportadora'],
          properties: {
            notaFiscal: { type: 'string', minLength: 1, maxLength: 60 },
            transportadora: { type: 'string', minLength: 1, maxLength: 120 },
            dataEntrada: { type: 'string', maxLength: 30 },
            observacoes: { type: 'string', maxLength: 2000 },
            equipamentos: { type: 'array', items: itemEquipamento, maxItems: 500 }
          },
          examples: [
            {
              notaFiscal: 'NF-2026-0042',
              transportadora: 'TransLog',
              observacoes: 'Recolhimento do 3º andar',
              equipamentos: [{ tipo: 'NOTEBOOK', marca: 'Dell', modelo: 'Latitude 5400', anoFabricacao: 2019, estadoFisico: 'USADO_MODERADO', pesoQuilogramas: 1.9 }]
            }
          ]
        },
        response: respostasDeErro(400, 401, 403, 422, 429)
      }
    },
    c.criarLote as never
  );

  app.get(
    '/rastreabilidade/:id',
    {
      onRequest: lerRastro,
      schema: {
        tags: TAG_RASTREIO,
        summary: 'Histórico completo de um equipamento (o código de barras interno é o próprio id)',
        security: segurancaChave,
        params: idParam,
        response: respostasDeErro(401, 403, 404, 429)
      }
    },
    c.rastrear as never
  );

  app.get(
    '/analises/:tipo',
    {
      onRequest: lerRelatorios,
      schema: {
        tags: TAG_ANALISES,
        summary: 'Última análise da organização (EFICIENCIA, RENTABILIDADE ou VIDA_UTIL), calculada na hora se ainda não existir',
        security: segurancaChave,
        params: tipoParam,
        response: respostasDeErro(401, 403, 429)
      }
    },
    c.analise as never
  );

  app.post(
    '/relatorios',
    {
      onRequest: lerRelatorios,
      schema: {
        tags: TAG_RELATORIOS,
        summary: 'Pede a geração assíncrona de um relatório (responde 202 com o id da tarefa)',
        description: 'Consulte GET /relatorios/{id} até o status ser CONCLUIDA e então baixe em /relatorios/{id}/download. Falhas temporárias são repetidas automaticamente (até 3 tentativas, com espera crescente).',
        security: segurancaChave,
        body: {
          type: 'object',
          required: ['tipo'],
          properties: {
            tipo: { type: 'string', enum: Object.values(TipoAnalise) },
            formato: { type: 'string', enum: Object.values(FormatoRelatorio), description: 'JSON (padrão) ou CSV' },
            inicio: { type: 'string', maxLength: 30, description: 'AAAA-MM-DD' },
            fim: { type: 'string', maxLength: 30, description: 'AAAA-MM-DD' }
          },
          examples: [{ tipo: 'EFICIENCIA', formato: 'CSV', inicio: '2026-01-01', fim: '2026-06-30' }]
        },
        response: respostasDeErro(400, 401, 403, 429)
      }
    },
    c.solicitarRelatorio as never
  );

  app.get('/relatorios/:id', { onRequest: lerRelatorios, schema: { tags: TAG_RELATORIOS, summary: 'Status da tarefa: PENDENTE, PROCESSANDO, CONCLUIDA ou FALHA', security: segurancaChave, params: idParam, response: respostasDeErro(401, 403, 404, 429) } }, c.statusRelatorio as never);

  app.get(
    '/relatorios/:id/download',
    { onRequest: lerRelatorios, schema: { tags: TAG_RELATORIOS, summary: 'Baixa o arquivo gerado (JSON ou CSV)', security: segurancaChave, params: idParam, response: respostasDeErro(401, 403, 404, 409, 429) } },
    c.baixarRelatorio as never
  );
}

// Oliver passou por aqui.
