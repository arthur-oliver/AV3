// Textos em português para os códigos da API, e formatadores.
export const STATUS = { AGUARDANDO_TRIAGEM: 'Aguardando triagem', EM_TRIAGEM: 'Em triagem', AGUARDANDO_DESMONTE: 'Aguardando desmonte', EM_DESMONTE: 'Em desmonte', PECAS_REAPROVEITADAS: 'Peças reaproveitadas', MATERIAL_RECICLAVEL: 'Material reciclável', DESCARTE_SEGURO: 'Descarte seguro', BAIXA_DEFINITIVA: 'Baixa definitiva' };
export const TIPOS = { COMPUTADOR_MESA: 'Computador de mesa', NOTEBOOK: 'Notebook', MONITOR: 'Monitor', IMPRESSORA: 'Impressora', SERVIDOR: 'Servidor', ROTEADOR: 'Roteador', CABO_ESTRUTURADO: 'Cabo estruturado', FONTE_ALIMENTACAO: 'Fonte de alimentação' };
export const ESTADOS = { NOVO: 'Novo', BOM_ESTADO: 'Bom estado', USADO_LEVE: 'Usado (leve)', USADO_MODERADO: 'Usado (moderado)', DANIFICADO_LEVE: 'Danificado (leve)', DANIFICADO_GRAVE: 'Danificado (grave)', INSERVIVEL: 'Inservível' };
export const ANALISES = { EFICIENCIA: 'Eficiência operacional', RENTABILIDADE: 'Rentabilidade por tipo', VIDA_UTIL: 'Vida útil restante' };
export const LOTES = { RECEBIDO: 'Recebido', EM_TRIAGEM: 'Em triagem', TRIAGEM_CONCLUIDA: 'Triagem concluída', ENCAMINHADO: 'Encaminhado', FINALIZADO: 'Finalizado' };
export const PERMISSOES = { LER_RASTREABILIDADE: 'Consultar lotes e rastrear equipamentos', ESCREVER_LOTES: 'Registrar lotes', LER_RELATORIOS: 'Ver análises e pedir relatórios' };
export const STATUS_TAREFA = { PENDENTE: ['Na fila', 'andamento'], PROCESSANDO: ['Processando', 'andamento'], CONCLUIDA: ['Pronto', 'ok'], FALHA: ['Falhou', 'erro'] };
export const PAPEIS = { SUPERUSUARIO: 'Superusuário', ADMINISTRADOR: 'Administrador', OPERADOR_CADASTRO: 'Operador de cadastro', GESTOR_ALMOXARIFADO: 'Gestor de almoxarifado', AUDITOR: 'Auditor' };
export const PAPEIS_COMUNS = Object.fromEntries(['ADMINISTRADOR', 'OPERADOR_CADASTRO', 'GESTOR_ALMOXARIFADO', 'AUDITOR'].map((p) => [p, PAPEIS[p]]));
export const PAPEL_TEXTO = {
  SUPERUSUARIO: 'Você tem o maior nível de acesso: faz o que todos os papéis fazem e é o único que cria, altera, desativa e exclui contas de usuário.',
  ADMINISTRADOR: 'Você cuida de toda a operação: organizações e contratos, lotes e equipamentos, relatórios, auditoria, análises, chaves de API e fila. Contas de usuário são só do superusuário.',
  OPERADOR_CADASTRO: 'Você cadastra e altera organizações e contratos. Lotes, equipamentos e relatórios ficam disponíveis só para consulta.',
  GESTOR_ALMOXARIFADO: 'Você registra lotes, faz a triagem e movimenta os equipamentos. Organizações e relatórios ficam disponíveis só para consulta.',
  AUDITOR: 'Você consulta tudo, sem alterar nada, e tem acesso à auditoria, às análises e aos pedidos de relatório.'
};

export const rotulo = (mapa, chave) => mapa[chave] || chave;
export const num = (n, c = 2) => (n === null || n === undefined ? '-' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: c }));
export const reais = (n) => (n === null || n === undefined ? '-' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
export const pct = (n) => (n === null || n === undefined ? '-' : `${num(n, 1)}%`);
export const data = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-');
export const dia = (d) => (d ? String(d).slice(0, 10) : '');
export const curto = (id) => (id ? String(id).slice(0, 8) : '-');
export const sn = (v) => (v ? 'Sim' : 'Não');
export const hoje = () => new Date().toISOString().slice(0, 10);
export const qs = (o) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') q.set(k, v);
  return q.toString();
};

// Arthur Oliver Rossi Alves, autor do Greencode.
