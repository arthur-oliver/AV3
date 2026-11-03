import Fastify, { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config';
import { prisma } from './lib/prisma';
import { registrarTratamentoErros } from './plugins/erros';
import { registrarAuth } from './plugins/auth';
import { registrarChaveApi } from './plugins/chaveApi';
import { rotasLegadas, rotasV1 } from './rotas/versoes';
import { rotasWeb } from './rotas/web';

export async function construirApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.ambiente !== 'test'
  });

  // Ao fechar o servidor, encerra também a conexão com o banco.
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  // Cabeçalhos de segurança (helmet). A política de conteúdo (CSP) fica desligada porque a interface /docs usa scripts próprios.
  await app.register(helmet, { contentSecurityPolicy: false });

  // CORS: só as origens listadas em CORS_ORIGIN. Sem a variável, nenhuma origem externa é liberada.
  await app.register(cors, { origin: config.corsOrigens.length > 0 ? config.corsOrigens : false, exposedHeaders: ['X-Total-Count', 'X-Pagina', 'X-Limite', 'X-API-Version', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After', 'Location'] });

  // Limite geral de requisições por IP (429 ao exceder). Desligado nos testes automatizados.
  if (config.ambiente !== 'test') {
    await app.register(rateLimit, {
      max: config.limiteRequisicoesPorMinuto,
      timeWindow: '1 minute'
    });
  }

  // Documentação automática da API (gerada a partir dos schemas das rotas).
  // Precisa ser registrada ANTES das rotas. Interface em: /docs
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Greencode API',
        version: '3.0.0',
        description:
          'API REST do sistema de logística reversa de resíduos eletrônicos.\n\n' +
          '**Rotas por público (versão 1):**\n' +
          '- `/api/v1/internal` - operação interna. Faça login em POST /api/v1/internal/auth/login, copie o token e clique em "Authorize" (bearerAuth).\n' +
          '- `/api/v1/admin` - administração (contas, chaves de API, fila). Mesmo token JWT.\n' +
          '- `/api/v1/public` - API para parceiros. Use uma chave no cabeçalho `X-API-Key` (apiKey). Cada chave tem permissões e limite de requisições por minuto próprios; ' +
          'as respostas trazem `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset` e, ao exceder, `Retry-After`.\n\n' +
          '**Erros:** sempre `{ "erro": "CODIGO", "mensagem": "texto" }`. **Versionamento:** toda resposta de /api/v1 traz `X-API-Version`. ' +
          'As rotas antigas sem prefixo (AV2) continuam funcionando, porém DEPRECADAS: respondem com `Deprecation`, `Sunset` e `Link` (versão nova).',
        contact: { name: 'Greencode', email: 'arthuroliverrossialves@gmail.com' }
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key', description: 'Chave de parceiro, formato gck_<12 hex>_<40 hex>' }
        }
      },
      tags: [
        { name: 'Sistema' },
        { name: 'Autenticação' },
        { name: 'Usuários' },
        { name: 'Organizações' },
        { name: 'Lotes' },
        { name: 'Equipamentos' },
        { name: 'Relatórios' },
        { name: 'Auditoria' },
        { name: 'Análises', description: 'Camada analítica: eficiência, rentabilidade e vida útil (histórico guardado em tabelas).' },
        { name: 'Relatórios assíncronos', description: 'Fila de processamento: pede, acompanha o status e baixa.' },
        { name: 'Chaves de API', description: 'Gestão das chaves dos parceiros (admin).' },
        { name: 'Fila (admin)', description: 'Visão administrativa da fila.' },
        { name: 'Público - Conta' },
        { name: 'Público - Lotes' },
        { name: 'Público - Rastreabilidade' },
        { name: 'Público - Análises' },
        { name: 'Público - Relatórios' }
      ]
    }
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  registrarTratamentoErros(app);
  await registrarAuth(app); // JWT + app.autenticar / app.autorizar (precisa vir ANTES das rotas)
  await registrarChaveApi(app); // chave de API + app.exigirChave (API pública)

  // Página inicial: abre o portal web. A documentação técnica continua em /docs.
  app.get('/', { schema: { hide: true } }, async (_req, reply) => reply.redirect('/app/'));
  await app.register(rotasWeb);

  // Verifica se o servidor e o banco estão respondendo (rota pública).
  app.get('/health', { schema: { tags: ['Sistema'], summary: 'Saúde do servidor e do banco' } }, async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', banco: 'conectado', hora: new Date().toISOString() };
    } catch (erro) {
      app.log.error(erro);
      return reply.status(503).send({ status: 'erro', banco: 'indisponivel' });
    }
  });

  await app.register(rotasV1, { prefix: '/api/v1' });
  await app.register(rotasLegadas); // rotas da AV2 sem prefixo (deprecadas)

  return app;
}

// Oliver passou por aqui.
