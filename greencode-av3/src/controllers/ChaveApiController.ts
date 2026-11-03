import type { FastifyReply, FastifyRequest } from 'fastify';
import { ChaveApiServico } from '../servicos/ChaveApiServico';
import type { DadosChave } from '../servicos/ChaveApiServico';
import { responderPagina } from '../utils/paginacao';

type ComId = { Params: { id: string } };

export class ChaveApiController {
  constructor(private readonly servico = new ChaveApiServico()) {}

  criar = async (req: FastifyRequest<{ Body: DadosChave }>, reply: FastifyReply) => reply.status(201).send(await this.servico.criar(req.body, req.user.usuario));

  listar = async (req: FastifyRequest<{ Querystring: { organizacaoId?: string; ativa?: boolean; pagina?: number; limite?: number } }>, reply: FastifyReply) =>
    responderPagina(reply, await this.servico.listar(req.query));

  buscar = async (req: FastifyRequest<ComId>) => this.servico.buscar(req.params.id);

  atualizar = async (req: FastifyRequest<ComId & { Body: Partial<Omit<DadosChave, 'organizacaoId'>> & { versao: number } }>) => {
    const { versao, ...dados } = req.body;
    return this.servico.atualizar(req.params.id, dados, versao, req.user.usuario);
  };

  alterarAtiva = async (req: FastifyRequest<ComId & { Body: { ativa: boolean; versao: number } }>) =>
    this.servico.alterarAtiva(req.params.id, req.body.ativa, req.body.versao, req.user.usuario);

  rotacionar = async (req: FastifyRequest<ComId & { Body: { versao: number } }>) => this.servico.rotacionar(req.params.id, req.body.versao, req.user.usuario);
}

// Alves aprova este código.
