// Pedaços de schema repetidos em várias rotas.
export const seguranca = [{ bearerAuth: [] }];
export const idParam = { type: 'object', required: ['id'], properties: { id: { type: 'string', minLength: 36, maxLength: 36 } } };
export const versao = { type: 'integer', minimum: 1 };
export const versaoQuery = { type: 'object', required: ['versao'], properties: { versao } };


// Autenticação por chave de API (rotas públicas): cabeçalho X-API-Key.
export const segurancaChave = [{ apiKey: [] }];

// Documentação padronizada dos erros: todo erro da API tem o formato { erro, mensagem }.
const MODELOS_DE_ERRO: Record<number, { descricao: string; erro: string; mensagem: string }> = {
  400: { descricao: 'Requisição inválida (parâmetro ausente, formato errado ou fora do limite).', erro: 'VALIDACAO', mensagem: "body must have required property 'notaFiscal'" },
  401: { descricao: 'Chave de API ausente, inválida, expirada ou revogada.', erro: 'CHAVE_API_INVALIDA', mensagem: 'Chave de API ausente ou inválida. Envie o cabeçalho X-API-Key.' },
  403: { descricao: 'A chave não tem a permissão exigida pela rota.', erro: 'SEM_PERMISSAO', mensagem: 'A chave não tem a permissão necessária: ESCREVER_LOTES.' },
  404: { descricao: 'Recurso não encontrado (ou pertencente a outra organização).', erro: 'NAO_ENCONTRADO', mensagem: 'Lote não encontrado(a).' },
  409: { descricao: 'Conflito (versão desatualizada ou recurso ainda não pronto).', erro: 'CONFLITO', mensagem: 'O relatório ainda não está pronto (status PROCESSANDO).' },
  422: { descricao: 'Regra de negócio violada.', erro: 'REGRA_NEGOCIO', mensagem: 'A organização não possui contrato ativo e não pode receber novos lotes.' },
  429: { descricao: 'Limite de requisições da chave excedido. Veja o cabeçalho Retry-After.', erro: 'LIMITE_DA_CHAVE', mensagem: 'Limite de 60 requisições por minuto excedido. Tente novamente em 12s.' }
};

// Monta o bloco "response" do schema só com os códigos de erro informados (aparecem no Swagger).
export function respostasDeErro(...codigos: number[]) {
  return Object.fromEntries(
    codigos.map((c) => [
      c,
      {
        description: MODELOS_DE_ERRO[c].descricao,
        type: 'object',
        properties: { erro: { type: 'string' }, mensagem: { type: 'string' } },
        examples: [{ erro: MODELOS_DE_ERRO[c].erro, mensagem: MODELOS_DE_ERRO[c].mensagem }]
      }
    ])
  );
}

// Arthur Oliver Rossi Alves, autor do Greencode.
