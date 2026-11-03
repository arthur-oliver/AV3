import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ChaveApiRepositorio } from '../repositorios/ChaveApiRepositorio';
import { chaveConfere, prefixoDaChave } from '../seguranca/chaveApi';
import { LimitadorPorChave } from '../seguranca/limitePorChave';
import { ChaveInvalida, LimiteDaChave, SemPermissao } from '../erros/AppError';
import type { PermissaoApi } from '../dominio/enums';

// Quem está chamando a API pública: preenchido em req.chaveApi depois da validação.
export interface ChaveContexto {
  id: string;
  nome: string;
  organizacaoId: string;
  permissoes: PermissaoApi[];
}

declare module 'fastify' {
  interface FastifyRequest {
    chaveApi: ChaveContexto | null;
  }
  interface FastifyInstance {
    /** Hook da API pública: valida X-API-Key, aplica o limite da chave e exige as permissões informadas. */
    exigirChave: (...permissoes: PermissaoApi[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const ATUALIZAR_USO_APOS_MS = 60_000;

export async function registrarChaveApi(app: FastifyInstance, repo = new ChaveApiRepositorio(), limitador = new LimitadorPorChave()): Promise<void> {
  app.decorateRequest('chaveApi', null);

  app.decorate('exigirChave', (...permissoes: PermissaoApi[]) => async (req: FastifyRequest, reply: FastifyReply) => {
    const bruto = req.headers['x-api-key'];
    const texto = Array.isArray(bruto) ? bruto[0] : bruto;
    const prefixo = texto ? prefixoDaChave(texto) : null;
    if (!texto || !prefixo) throw new ChaveInvalida();

    const c = await repo.buscarPorPrefixo(prefixo);
    if (!c || !chaveConfere(texto, c.hashChave)) throw new ChaveInvalida();
    if (!c.ativa) throw new ChaveInvalida('Chave de API revogada.');
    if (c.expiraEm && c.expiraEm.getTime() <= Date.now()) throw new ChaveInvalida('Chave de API expirada.');

    // Limite por chave (janela de 1 minuto). Os cabeçalhos X-RateLimit-* seguem em todas as respostas.
    const lim = limitador.consumir(c.id, c.limitePorMinuto);
    reply.header('X-RateLimit-Limit', String(lim.limite)).header('X-RateLimit-Remaining', String(lim.restante)).header('X-RateLimit-Reset', String(lim.reiniciaEmSegundos));
    if (!lim.permitido) {
      reply.header('Retry-After', String(lim.reiniciaEmSegundos));
      throw new LimiteDaChave(`Limite de ${lim.limite} requisições por minuto excedido. Tente novamente em ${lim.reiniciaEmSegundos}s.`);
    }

    const concedidas = c.permissoes as PermissaoApi[];
    const faltando = permissoes.filter((p) => !concedidas.includes(p));
    if (faltando.length) throw new SemPermissao(`A chave não tem a permissão necessária: ${faltando.join(', ')}.`);

    req.chaveApi = { id: c.id, nome: c.nome, organizacaoId: c.organizacaoId, permissoes: concedidas };

    // Registra o último uso sem atrasar a resposta (no máximo uma vez por minuto por chave).
    if (!c.ultimoUsoEm || Date.now() - c.ultimoUsoEm.getTime() > ATUALIZAR_USO_APOS_MS) repo.registrarUso(c.id).catch(() => undefined);
  });
}

// este trecho tem o dedo do Rossi.
