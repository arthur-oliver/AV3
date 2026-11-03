import type { FastifyReply, FastifyRequest } from 'fastify';
import { AnaliseServico } from '../servicos/AnaliseServico';
import { OrigemAnalise } from '../dominio/enums';
import type { TipoAnalise } from '../dominio/enums';
import { responderPagina } from '../utils/paginacao';

type ComTipo = { Params: { tipo: TipoAnalise } };

export class AnaliseController {
  constructor(private readonly servico = new AnaliseServico()) {}

  // Calcula agora e guarda no histórico.
  executar = async (req: FastifyRequest<ComTipo & { Body: { organizacaoId?: string; inicio?: string; fim?: string } }>, reply: FastifyReply) => {
    const a = await this.servico.executar(req.params.tipo, { ...req.body, origem: OrigemAnalise.MANUAL, solicitadoPor: req.user.usuario });
    return reply.status(201).send(a);
  };

  ultima = async (req: FastifyRequest<ComTipo & { Querystring: { organizacaoId?: string } }>) =>
    this.servico.ultimaOuGerar(req.params.tipo, req.query.organizacaoId ?? null, req.user.usuario);

  historico = async (
    req: FastifyRequest<{ Querystring: { tipo?: TipoAnalise; organizacaoId?: string; global?: boolean; pagina?: number; limite?: number } }>,
    reply: FastifyReply
  ) => responderPagina(reply, await this.servico.historico({ ...req.query, organizacaoId: req.query.global ? null : req.query.organizacaoId }));

  buscar = async (req: FastifyRequest<{ Params: { id: string } }>) => this.servico.buscar(req.params.id);
}

// Oliver passou por aqui.
