import { AnaliseServico } from '../servicos/AnaliseServico';
import { resultadoParaCsv } from '../analytics/exportacao';
import { OrigemAnalise } from '../dominio/enums';
import type { FormatoRelatorio, TipoAnalise } from '../dominio/enums';

export interface TarefaParaProcessar {
  id: string;
  tipo: TipoAnalise;
  formato: FormatoRelatorio;
  organizacaoId: string | null;
  solicitadoPor: string;
  parametros: unknown;
}

export interface SaidaRelatorio {
  conteudo: string;
  tipoConteudo: string;
  nomeArquivo: string;
  tamanhoBytes: number;
}

// Executa o trabalho pesado de uma tarefa: calcula a análise (e a guarda no histórico) e gera o arquivo.
export class ProcessadorRelatorio {
  constructor(private readonly analises = new AnaliseServico()) {}

  async processar(t: TarefaParaProcessar): Promise<SaidaRelatorio> {
    const p = (t.parametros ?? {}) as { inicio?: string | null; fim?: string | null };
    const analise = await this.analises.executar(t.tipo, {
      organizacaoId: t.organizacaoId,
      inicio: p.inicio ?? undefined,
      fim: p.fim ?? undefined,
      origem: OrigemAnalise.TAREFA,
      solicitadoPor: t.solicitadoPor
    });
    const csv = t.formato === 'CSV';
    const conteudo = csv ? resultadoParaCsv(t.tipo, analise.resultado) : JSON.stringify(analise, null, 2);
    return {
      conteudo,
      tipoConteudo: csv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      nomeArquivo: `${t.tipo.toLowerCase()}-${t.id.slice(0, 8)}.${csv ? 'csv' : 'json'}`,
      tamanhoBytes: Buffer.byteLength(conteudo)
    };
  }
}

// este trecho tem o dedo do Rossi.
