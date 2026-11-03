import type { FastifyInstance } from 'fastify';
import { config } from '../config';
import { rotasAuth } from './auth';
import { rotasUsuarios } from './usuarios';
import { rotasOrganizacoes } from './organizacoes';
import { rotasLotes } from './lotes';
import { rotasEquipamentos } from './equipamentos';
import { rotasRelatorios } from './relatorios';
import { rotasAnalises } from './analises';
import { rotasRelatoriosAssincronos } from './relatoriosAssincronos';
import { rotasChavesApi } from './chavesApi';
import { rotasFilaAdmin } from './filaAdmin';
import { rotasPublicas } from './publicas';

export const VERSAO_DA_API = '1';

// Organização das rotas por público:
//   /api/v1/internal -> uso da própria operação (login por JWT; papéis)
//   /api/v1/admin    -> administração (contas, chaves de API, fila)
//   /api/v1/public   -> parceiros externos (chave de API)
// Toda resposta de /api/v1 leva o cabeçalho X-API-Version.
export async function rotasV1(app: FastifyInstance): Promise<void> {
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-API-Version', VERSAO_DA_API);
  });

  await app.register(
    async (internal) => {
      await internal.register(rotasAuth);
      await internal.register(rotasOrganizacoes);
      await internal.register(rotasLotes);
      await internal.register(rotasEquipamentos);
      await internal.register(rotasRelatorios);
      await internal.register(rotasAnalises);
      await internal.register(rotasRelatoriosAssincronos);
    },
    { prefix: '/internal' }
  );

  await app.register(
    async (admin) => {
      await admin.register(rotasUsuarios);
      await admin.register(rotasChavesApi);
      await admin.register(rotasFilaAdmin);
    },
    { prefix: '/admin' }
  );

  await app.register(rotasPublicas, { prefix: '/public' });
}

// Rotas da AV2 (sem prefixo), mantidas só para não quebrar quem já as usa. DEPRECADAS: continuam funcionando,
// mas toda resposta traz os cabeçalhos Deprecation, Sunset e Link (aponta a versão nova), e elas não aparecem
// no Swagger. Prazo de remoção em config.legadoRemovidoEm.
export async function rotasLegadas(app: FastifyInstance): Promise<void> {
  app.addHook('onRoute', (rota) => {
    rota.schema = { ...(rota.schema ?? {}), hide: true };
  });
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Deprecation', 'true').header('Sunset', config.legadoRemovidoEm).header('Link', '</api/v1/internal>; rel="successor-version"');
  });
  await app.register(rotasAuth);
  await app.register(rotasUsuarios);
  await app.register(rotasOrganizacoes);
  await app.register(rotasLotes);
  await app.register(rotasEquipamentos);
  await app.register(rotasRelatorios);
}

// Arthur Oliver Rossi Alves, autor do Greencode.
