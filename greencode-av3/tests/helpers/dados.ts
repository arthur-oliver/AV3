// Dados realistas para os testes de integração. Nada de "teste", "X" ou sufixos aleatórios nos nomes:
// cada chamada devolve um registro com cara de cadastro real (empresa, pessoa, nota fiscal, transportadora).
// Os testes rodam num banco próprio (ver tests/setup/bancoDeTeste.ts), mas mesmo lá os dados são plausíveis.
import { gerarCnpjValido } from './cnpj';

const EMPRESAS = [
  ['Distribuidora Ponte Alta Ltda', 'Rua Coronel Fonseca, 812 - Centro, Campinas/SP - CEP 13010-140', '(19) 3232-4180', 'pontealta'],
  ['Clínica Bem Viver Serviços Médicos Ltda', 'Av. Getúlio Vargas, 1450 - Funcionários, Belo Horizonte/MG - CEP 30112-021', '(31) 3261-7720', 'clinicabemviver'],
  ['Escola Técnica Nova Geração Ltda', 'Rua Marechal Deodoro, 377 - Centro, Joinville/SC - CEP 89201-200', '(47) 3422-5106', 'etnovageracao'],
  ['Transportes Serra Gaúcha Ltda', 'Rod. RS-122, km 68 - Distrito Industrial, Caxias do Sul/RS - CEP 95112-000', '(54) 3215-9930', 'serragaucha'],
  ['Contabilidade Exata Assessoria Empresarial Ltda', 'Rua XV de Novembro, 1290 - Centro, Curitiba/PR - CEP 80060-000', '(41) 3324-6612', 'contabilexata'],
  ['Mercado Família Feliz Ltda', 'Av. Brasil, 2205 - Jardim América, Goiânia/GO - CEP 74265-010', '(62) 3251-4473', 'familiafeliz'],
  ['Indústria de Plásticos Atlântico Ltda', 'Rua das Indústrias, 540 - Distrito Industrial, Recife/PE - CEP 50770-480', '(81) 3445-2290', 'plasticosatlantico'],
  ['Consultoria Delta Tecnologia da Informação Ltda', 'Av. Tancredo Neves, 620 - Caminho das Árvores, Salvador/BA - CEP 41820-020', '(71) 3341-8854', 'deltati'],
  ['Hotel Fazenda Recanto das Águas Ltda', 'Estrada Municipal, km 12 - Zona Rural, Socorro/SP - CEP 13960-000', '(19) 3895-1377', 'recantodasaguas'],
  ['Laboratório Análise Certa Ltda', 'Rua Barão do Rio Branco, 945 - Centro, Fortaleza/CE - CEP 60025-061', '(85) 3253-6019', 'analisecerta'],
  ['Editora Caminhos do Saber Ltda', 'Rua Augusta, 1508 - Consolação, São Paulo/SP - CEP 01304-001', '(11) 3284-7795', 'caminhosdosaber'],
  ['Cooperativa Agrícola Planalto Verde', 'Av. Presidente Vargas, 3100 - Centro, Passo Fundo/RS - CEP 99010-000', '(54) 3313-2048', 'planaltoverde']
] as const;

const PESSOAS = [
  'Ana Paula Ribeiro', 'Bruno Henrique Costa', 'Camila Ferreira Lima', 'Diego Almeida Santos', 'Eduarda Martins Rocha',
  'Felipe Augusto Nunes', 'Gabriela Souza Pires', 'Henrique Barbosa Teles', 'Isabela Cardoso Melo', 'João Victor Araújo',
  'Larissa Gomes Fontes', 'Marcelo Duarte Prado', 'Natália Oliveira Reis', 'Otávio Moreira Campos', 'Patrícia Lopes Vieira',
  'Rafael Teixeira Dias', 'Sabrina Castro Lima', 'Thiago Mendes Farias', 'Vanessa Rodrigues Alves', 'William Correia Neto'
];

export const TRANSPORTADORAS = ['Rota Sul Cargas', 'LogVerde Transportes', 'TransRapida Logística', 'Expresso Nordeste'] as const;

let empresas = 0;
let pessoas = 0;
let notas = 0;
const execucao = Date.now() % 100000; // só para variar a numeração entre execuções

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Organização completa (todos os campos preenchidos). O CNPJ é válido e único a cada chamada.
export function novaEmpresa() {
  const i = empresas++;
  const [razao, endereco, telefone, dominio] = EMPRESAS[i % EMPRESAS.length];
  const filial = Math.floor(i / EMPRESAS.length);
  return {
    razaoSocial: filial === 0 ? razao : `${razao} - Filial ${filial + 1}`,
    cnpj: gerarCnpjValido(),
    inscricaoEstadual: String(100000000 + ((i * 7919 + execucao) % 899999999)),
    enderecoCompleto: endereco,
    telefone,
    email: `${filial === 0 ? 'contato' : `filial${filial + 1}`}@${dominio}.example`
  };
}

// Pessoa com login no padrão nome.sobrenome (único dentro da execução).
export function novaPessoa() {
  const i = pessoas++;
  const nome = PESSOAS[i % PESSOAS.length];
  const partes = semAcento(nome).toLowerCase().split(' ');
  const base = `${partes[0]}.${partes[partes.length - 1]}`;
  const volta = Math.floor(i / PESSOAS.length);
  return { nome, usuario: volta === 0 ? base : `${base}${volta + 1}` };
}

// Número de nota fiscal no formato usado no seed (NF-xxxxxx).
export function novaNotaFiscal() {
  notas++;
  return `NF-${String(500000 + ((execucao * 37 + notas) % 499999)).padStart(6, '0')}`;
}

export const transportadora = () => TRANSPORTADORAS[notas % TRANSPORTADORAS.length];

export const CLAUSULAS = [
  'Coleta mensal programada de equipamentos eletrônicos.',
  'Emissão de certificado de destinação ambiental.',
  'Rastreabilidade completa de cada equipamento.'
];

// Contrato vigente padrão (vence em 2099 para não expirar durante os testes).
export const contratoVigente = (valorMensal = 3500) => ({ dataVencimento: '2099-12-31', clausulas: CLAUSULAS, valorMensal });
