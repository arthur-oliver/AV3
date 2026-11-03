import type { FastifyReply, FastifyRequest } from 'fastify';
import { LoteServico } from '../servicos/LoteServico';
import type { DadosLote } from '../servicos/LoteServico';
import { EquipamentoServico } from '../servicos/EquipamentoServico';
import { AnaliseServico } from '../servicos/AnaliseServico';
import { FilaServico, apresentarTarefa } from '../servicos/FilaServico';
import { NaoEncontrado } from '../erros/AppError';
import { responderPagina } from '../utils/paginacao';
import { enviarArquivo } from '../utils/resposta';
import type { FormatoRelatorio, StatusLote, TipoAnalise } from '../dominio/enums';

type ComId = { Params: { id: string } };
const BASE = '/api/v1/public/relatorios';

// Controller da API pública. Toda consulta é restrita à organização dona da chave (req.chaveApi): um parceiro
// nunca enxerga dados de outro. Recurso de outra organização responde 404, como se não existisse.
export class PublicoController {
  constructor(
    private readonly lotes = new LoteServico(),
    private readonly equipamentos = new EquipamentoServico(),
    private readonly analises = new AnaliseServico(),
    private readonly fila = new FilaServico()
  ) {}

  private org(req: FastifyRequest): string {
    return req.chaveApi!.organizacaoId;
  }

  private autor(req: FastifyRequest): string {
    return `api:${req.chaveApi!.nome}`;
  }

  eu = async (req: FastifyRequest) => ({ chave: req.chaveApi!.nome, organizacaoId: this.org(req), permissoes: req.chaveApi!.permissoes });

  listarLotes = async (req: FastifyRequest<{ Querystring: { status?: StatusLote; inicio?: string; fim?: string; pagina?: number; limite?: number } }>, reply: FastifyReply) =>
    responderPagina(reply, await this.lotes.listar({ ...req.query, organizacaoId: this.org(req), ativo: true }));

  buscarLote = async (req: FastifyRequest<ComId>) => {
    const l = await this.lotes.buscar(req.params.id);
    if (l.organizacaoId !== this.org(req) || !l.ativo) throw new NaoEncontrado('Lote');
    return l;
  };

  criarLote = async (req: FastifyRequest<{ Body: Omit<DadosLote, 'organizacaoId'> }>, reply: FastifyReply) =>
    reply.status(201).send(await this.lotes.criar({ ...req.body, organizacaoId: this.org(req) }, this.autor(req)));

  rastrear = async (req: FastifyRequest<ComId>) => {
    const r = await this.equipamentos.rastrear(req.params.id);
    if (r.equipamento.lote.organizacaoId !== this.org(req) || !r.equipamento.lote.ativo) throw new NaoEncontrado('Equipamento');
    return r;
  };

  analise = async (req: FastifyRequest<{ Params: { tipo: TipoAnalise } }>) => this.analises.ultimaOuGerar(req.params.tipo, this.org(req), this.autor(req));

  solicitarRelatorio = async (req: FastifyRequest<{ Body: { tipo: TipoAnalise; formato?: FormatoRelatorio; inicio?: string; fim?: string } }>, reply: FastifyReply) => {
    const t = await this.fila.enfileirar({ ...req.body, formato: req.body.formato ?? 'JSON', organizacaoId: this.org(req), chaveApiId: req.chaveApi!.id, solicitadoPor: this.autor(req) });
    return reply.status(202).header('Location', `${BASE}/${t.id}`).send(apresentarTarefa(t, BASE));
  };

  statusRelatorio = async (req: FastifyRequest<ComId>) => apresentarTarefa(await this.fila.consultar(req.params.id, this.org(req)), BASE);

  baixarRelatorio = async (req: FastifyRequest<ComId>, reply: FastifyReply) => enviarArquivo(reply, await this.fila.baixar(req.params.id, this.org(req)));
}

// Oliver passou por aqui.
