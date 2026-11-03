import type { FastifyReply, FastifyRequest } from 'fastify';
import { FilaServico, apresentarTarefa } from '../servicos/FilaServico';
import { AnaliseServico } from '../servicos/AnaliseServico';
import { responderPagina } from '../utils/paginacao';
import { enviarArquivo } from '../utils/resposta';
import type { FormatoRelatorio, StatusTarefa, TipoAnalise } from '../dominio/enums';

type ComId = { Params: { id: string } };
const BASE = '/api/v1/internal/relatorios-assincronos';
const BASE_ADMIN = '/api/v1/admin/fila/tarefas';

export class FilaController {
  constructor(
    private readonly fila = new FilaServico(),
    private readonly analises = new AnaliseServico()
  ) {}

  // --- internal: o usuário logado pede um relatório e acompanha ---

  solicitar = async (
    req: FastifyRequest<{ Body: { tipo: TipoAnalise; formato?: FormatoRelatorio; organizacaoId?: string; inicio?: string; fim?: string } }>,
    reply: FastifyReply
  ) => {
    const t = await this.fila.enfileirar({ ...req.body, formato: req.body.formato ?? 'JSON', solicitadoPor: req.user.usuario });
    return reply.status(202).header('Location', `${BASE}/${t.id}`).send(apresentarTarefa(t, BASE));
  };

  status = async (req: FastifyRequest<ComId>) => apresentarTarefa(await this.fila.consultar(req.params.id), BASE);

  baixar = async (req: FastifyRequest<ComId>, reply: FastifyReply) => enviarArquivo(reply, await this.fila.baixar(req.params.id));

  // --- admin: visão geral da fila ---

  listar = async (req: FastifyRequest<{ Querystring: { status?: StatusTarefa; tipo?: TipoAnalise; organizacaoId?: string; pagina?: number; limite?: number } }>, reply: FastifyReply) => {
    const p = await this.fila.listar(req.query);
    return responderPagina(reply, { ...p, itens: p.itens.map((t) => apresentarTarefa(t, BASE_ADMIN)) });
  };

  resumo = async () => ({ porStatus: await this.fila.resumo() });

  reenfileirar = async (req: FastifyRequest<ComId>) => apresentarTarefa(await this.fila.reenfileirar(req.params.id), BASE_ADMIN);

  // Dispara agora o mesmo trabalho do agendador (todas as análises, global e por organização).
  executarAgendadas = async () => this.analises.executarTodasAgendadas();
}

// escrito com carinho por Arthur.
