import { AnaliticoRepositorio } from '../repositorios/AnaliticoRepositorio';
import { OrganizacaoRepositorio } from '../repositorios/OrganizacaoRepositorio';
import { calcularAnalise } from '../analytics/motor';
import { NaoEncontrado } from '../erros/AppError';
import { intervalo } from '../utils/datas';
import { lerPaginacao, montarPagina } from '../utils/paginacao';
import { OrigemAnalise, TipoAnalise } from '../dominio/enums';

export interface OpcoesAnalise {
  organizacaoId?: string | null;
  inicio?: string;
  fim?: string;
  origem: OrigemAnalise;
  solicitadoPor: string;
}

type Salvo = NonNullable<Awaited<ReturnType<AnaliticoRepositorio['buscarPorId']>>>;

// Formato público de uma análise salva.
export function apresentar(a: Salvo) {
  return {
    id: a.id,
    tipo: a.tipo,
    organizacaoId: a.organizacaoId,
    origem: a.origem,
    periodo: { inicio: a.periodoInicio, fim: a.periodoFim },
    geradoEm: a.geradoEm,
    duracaoMs: a.duracaoMs,
    parametros: a.parametros,
    resultado: a.resultado
  };
}

export class AnaliseServico {
  constructor(
    private readonly repo = new AnaliticoRepositorio(),
    private readonly organizacoes = new OrganizacaoRepositorio()
  ) {}

  // Calcula a análise, GUARDA o resultado como uma linha nova (o histórico nunca é sobrescrito) e devolve.
  // A vida útil olha todo o histórico por padrão (precisa de bastante dado); as demais, os últimos 90 dias.
  async executar(tipo: TipoAnalise, op: OpcoesAnalise) {
    if (op.organizacaoId && !(await this.organizacoes.buscarPorId(op.organizacaoId))) throw new NaoEncontrado('Organização');
    const per = intervalo(op.inicio ?? (tipo === TipoAnalise.VIDA_UTIL ? '1970-01-01' : undefined), op.fim);

    const inicioCalculo = Date.now();
    const eqs = await this.repo.carregarEquipamentos({ organizacaoId: op.organizacaoId, inicio: per.inicio, fim: per.fim });
    const { resultado, parametros } = calcularAnalise(tipo, eqs, per);
    const salvo = await this.repo.salvar({
      tipo,
      organizacaoId: op.organizacaoId ?? null,
      origem: op.origem,
      solicitadoPor: op.solicitadoPor,
      periodoInicio: per.inicio,
      periodoFim: per.fim,
      parametros,
      resultado,
      duracaoMs: Date.now() - inicioCalculo
    });
    return apresentar(salvo);
  }

  // Última análise guardada do escopo; se nunca houve, calcula agora.
  async ultimaOuGerar(tipo: TipoAnalise, organizacaoId: string | null, solicitadoPor: string) {
    const a = await this.repo.ultimo(tipo, organizacaoId);
    return a ? apresentar(a) : this.executar(tipo, { organizacaoId, origem: OrigemAnalise.MANUAL, solicitadoPor });
  }

  async historico(f: { tipo?: TipoAnalise; organizacaoId?: string | null; pagina?: number; limite?: number }) {
    const pag = lerPaginacao(f);
    const [itens, total] = await this.repo.historico(f.tipo, f.organizacaoId, pag);
    return montarPagina(itens.map(apresentar), total, pag);
  }

  async buscar(id: string) {
    const a = await this.repo.buscarPorId(id);
    if (!a) throw new NaoEncontrado('Análise');
    return apresentar(a);
  }

  // Roda os 3 tipos para o escopo global e para cada organização ativa (período padrão de cada tipo).
  // Uma falha isolada não interrompe as demais; no fim devolve o balanço.
  // "pular" evita calcular de novo uma combinação que acabou de ser calculada (ver executarTodas).
  async executarTodasAgendadas(
    autor: { origem: OrigemAnalise; solicitadoPor: string } = { origem: OrigemAnalise.AGENDADA, solicitadoPor: 'agendador' },
    pular?: { tipo: TipoAnalise; organizacaoId: string | null }
  ) {
    const escopos: (string | null)[] = [null, ...(await this.repo.organizacoesAtivas()).map((o) => o.id)];
    let executadas = 0;
    const falhas: string[] = [];
    for (const organizacaoId of escopos) {
      for (const tipo of Object.values(TipoAnalise)) {
        if (pular && pular.tipo === tipo && pular.organizacaoId === organizacaoId) continue;
        try {
          await this.executar(tipo, { organizacaoId, ...autor });
          executadas += 1;
        } catch (erro) {
          falhas.push(`${tipo}/${organizacaoId ?? 'global'}: ${erro instanceof Error ? erro.message : String(erro)}`);
        }
      }
    }
    return { executadas, falhas };
  }

  // "Calcular agora" do portal: calcula a análise escolhida (com os filtros informados) e, em seguida,
  // atualiza as 3 análises de todos os escopos, como o agendador faria. Tudo fica no histórico como MANUAL,
  // em nome de quem pediu. Devolve a análise escolhida (para exibir) e o balanço do restante.
  async executarTodas(tipo: TipoAnalise, op: Omit<OpcoesAnalise, 'origem'>) {
    const autor = { origem: OrigemAnalise.MANUAL, solicitadoPor: op.solicitadoPor };
    const escolhida = await this.executar(tipo, { ...op, ...autor });
    // Sem período informado, a escolhida é igual à que o lote calcularia: não repete.
    const semPeriodo = !op.inicio && !op.fim;
    const balanco = await this.executarTodasAgendadas(autor, semPeriodo ? { tipo, organizacaoId: op.organizacaoId ?? null } : undefined);
    return { analise: escolhida, executadas: balanco.executadas + 1, falhas: balanco.falhas };
  }
}

// este trecho tem o dedo do Rossi.
