// Carga inicial de dados (seed). Idempotente: pode rodar várias vezes sem duplicar registros.
// Execução: npm run db:seed
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ORGS_EXTRAS } from './dados-organizacoes';

const prisma = new PrismaClient();

const diasAtras = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const emDias = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

// Completa um CNPJ (8 dígitos de base) com a filial 0001 e os dígitos verificadores.
function cnpjCompleto(base8: string): string {
  const dv = (s: string, peso: number) => {
    let soma = 0;
    for (const ch of s) {
      soma += Number(ch) * peso--;
      if (peso < 2) peso = 9;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const base = `${base8}0001`;
  const d1 = dv(base, 5);
  return `${base}${d1}${dv(base + d1, 6)}`;
}

// IDs fixos das organizações extras (dados-organizacoes.ts) e dos lotes delas.
const idOrgExtra = (i: number) => `00000000-0000-4000-8000-0000000001${String(i + 1).padStart(2, '0')}`;
const idLoteExtra = (i: number) => `00000000-0000-4000-8000-0000000002${String(i + 1).padStart(2, '0')}`;

// Observação registrada em cada passo do histórico do equipamento.
const OBS_MOVIMENTO: Record<string, string> = {
  AGUARDANDO_TRIAGEM: 'Recebimento do lote na central de triagem.',
  EM_TRIAGEM: 'Equipamento conferido, etiquetado e encaminhado para a triagem.',
  AGUARDANDO_DESMONTE: 'Triagem concluída: indicado para desmonte.',
  EM_DESMONTE: 'Desmonte iniciado na bancada técnica.',
  PECAS_REAPROVEITADAS: 'Peças em condições de uso separadas para reaproveitamento.',
  MATERIAL_RECICLAVEL: 'Material separado por tipo e enviado à recicladora parceira.',
  DESCARTE_SEGURO: 'Dados destruídos e descarte seguro realizado, com certificado emitido.',
  BAIXA_DEFINITIVA: 'Destinação concluída e baixa definitiva registrada.'
};

// IDs fixos só para o seed ser repetível.
const ID = {
  orgBanco: '00000000-0000-4000-8000-0000000000a1',
  orgHospital: '00000000-0000-4000-8000-0000000000a2',
  orgUniversidade: '00000000-0000-4000-8000-0000000000a3',
  orgVarejo: '00000000-0000-4000-8000-0000000000a4',
  orgConstrutora: '00000000-0000-4000-8000-0000000000a5',
  lote1: '00000000-0000-4000-8000-0000000000b1',
  lote2: '00000000-0000-4000-8000-0000000000b2',
  lote3: '00000000-0000-4000-8000-0000000000b3',
  lote4: '00000000-0000-4000-8000-0000000000b4',
  lote5: '00000000-0000-4000-8000-0000000000b5',
  lote6: '00000000-0000-4000-8000-0000000000b6',
  lote7: '00000000-0000-4000-8000-0000000000b7',
  lote8: '00000000-0000-4000-8000-0000000000b8',
  lote9: '00000000-0000-4000-8000-0000000000b9',
  lote10: '00000000-0000-4000-8000-0000000000ba',
  lote11: '00000000-0000-4000-8000-0000000000bb'
};

// Contas de demonstração entram SEM troca obrigatória de senha, para os testes automatizados e a correção
// funcionarem de cara. Para exigir a troca também nelas: SEED_EXIGE_TROCA=true npm run db:seed (em banco novo).
// Usuários criados pelo superusuário no sistema SEMPRE exigem a troca no primeiro acesso.
const EXIGE_TROCA = process.env.SEED_EXIGE_TROCA === 'true';

async function usuarios() {
  const lista = [
    { usuario: 'superusuario', nome: 'Helena Vasconcelos Prado', senha: 'Super@123', papel: 'SUPERUSUARIO' },
    { usuario: 'admin', nome: 'Ricardo Monteiro Lima', senha: 'Admin@123', papel: 'ADMINISTRADOR' },
    { usuario: 'operador', nome: 'Juliana Freitas Andrade', senha: 'Operador@123', papel: 'OPERADOR_CADASTRO' },
    { usuario: 'gestor', nome: 'Marcos Antônio Teixeira', senha: 'Gestor@123', papel: 'GESTOR_ALMOXARIFADO' },
    { usuario: 'auditor', nome: 'Fernanda Carvalho Brito', senha: 'Auditor@123', papel: 'AUDITOR' }
  ] as const;

  for (const u of lista) {
    await prisma.usuario.upsert({
      where: { usuario: u.usuario },
      update: {},
      create: { usuario: u.usuario, nome: u.nome, senhaHash: await bcrypt.hash(u.senha, 10), papel: u.papel, trocaSenhaObrigatoria: EXIGE_TROCA }
    });
  }
}

async function organizacoes() {
  const orgs = [
    {
      id: ID.orgBanco,
      razaoSocial: 'Banco Horizonte S.A.',
      cnpj: '11222333000181',
      inscricaoEstadual: '110042490114',
      enderecoCompleto: 'Av. Paulista, 1000, 12º andar - Bela Vista, São Paulo/SP - CEP 01310-100',
      dataCadastro: diasAtras(400),
      telefone: '(11) 3000-1000',
      email: 'ti@bancohorizonte.example',
      contrato: { valor: '15000.00', venc: emDias(300), auto: true }
    },
    {
      id: ID.orgHospital,
      razaoSocial: 'Hospital Vida Plena',
      cnpj: '45678912000155',
      inscricaoEstadual: 'ISENTO',
      enderecoCompleto: 'Rua das Flores, 200 - Centro, Curitiba/PR - CEP 80020-090',
      dataCadastro: diasAtras(360),
      telefone: '(41) 3000-2000',
      email: 'suprimentos@vidaplena.example',
      contrato: { valor: '8200.50', venc: emDias(120), auto: false }
    },
    {
      // Sem contrato: o contrato é opcional na AV2.
      id: ID.orgUniversidade,
      razaoSocial: 'Universidade Federal Exemplo',
      cnpj: '98765432000198',
      inscricaoEstadual: 'ISENTO',
      enderecoCompleto: 'Av. Antônio Carlos, 6627 - Pampulha, Belo Horizonte/MG - CEP 31270-901',
      dataCadastro: diasAtras(320),
      telefone: '(31) 3000-3000',
      email: 'patrimonio@ufexemplo.example',
      contrato: null
    },
    {
      // Segunda empresa parceira (além do banco): tem chave de demonstração própria (npm run chave:demo -- --org=varejo).
      id: ID.orgVarejo,
      razaoSocial: 'Varejo Nova Era Comércio Ltda',
      cnpj: '33445566000186',
      inscricaoEstadual: '0623145870012',
      enderecoCompleto: 'Rua Voluntários da Pátria, 455 - Centro Histórico, Porto Alegre/RS - CEP 90030-003',
      dataCadastro: diasAtras(280),
      telefone: '(51) 3000-4000',
      email: 'operacoes@novaera.example',
      contrato: { valor: '11750.00', venc: emDias(540), auto: true, assinatura: 150 }
    },
    {
      // Organização desativada, com contrato já vencido: aparece no filtro "Inativas".
      id: ID.orgConstrutora,
      razaoSocial: 'Construtora Alicerce Ltda',
      cnpj: '55667788000186',
      inscricaoEstadual: '7980012345',
      enderecoCompleto: 'Av. Sete de Setembro, 3200 - Barra, Salvador/BA - CEP 40130-001',
      dataCadastro: diasAtras(440),
      telefone: '(71) 3000-5000',
      email: 'administrativo@alicerce.example',
      ativo: false,
      contrato: { valor: '4300.00', venc: diasAtras(20), auto: false, assinatura: 385 }
    }
  ];

  for (const [i, o] of ORGS_EXTRAS.entries()) {
    const id = idOrgExtra(i);
    await prisma.organizacao.upsert({
      where: { id },
      update: {},
      create: {
        id, razaoSocial: o.razaoSocial, cnpj: cnpjCompleto(o.cnpjBase), inscricaoEstadual: o.inscricaoEstadual,
        enderecoCompleto: o.enderecoCompleto, telefone: o.telefone, email: o.email, ativo: o.ativo ?? true, dataCadastro: diasAtras(o.cadastro)
      }
    });
    if (o.contrato) {
      await prisma.contrato.upsert({
        where: { organizacaoId: id },
        update: {},
        create: {
          organizacaoId: id, dataAssinatura: diasAtras(o.contrato.assinatura), dataVencimento: emDias(o.contrato.venc),
          clausulas: o.contrato.clausulas, valorMensal: o.contrato.valor, renovacaoAutomatica: o.contrato.auto
        }
      });
    }
  }

  for (const o of orgs) {
    const { contrato, ...dados } = o;
    await prisma.organizacao.upsert({ where: { id: o.id }, update: {}, create: dados });
    if (contrato) {
      await prisma.contrato.upsert({
        where: { organizacaoId: o.id },
        update: {},
        create: {
          organizacaoId: o.id,
          dataAssinatura: diasAtras(('assinatura' in contrato ? contrato.assinatura : undefined) ?? 300),
          dataVencimento: contrato.venc,
          clausulas: [
            'Coleta mensal programada de equipamentos eletrônicos.',
            'Emissão de certificado de destinação ambiental.',
            'Rastreabilidade completa de cada equipamento.'
          ],
          valorMensal: contrato.valor,
          renovacaoAutomatica: contrato.auto
        }
      });
    }
  }
}

async function lotesEEquipamentos() {
  const lotes = [
    { id: ID.lote1, organizacaoId: ID.orgBanco, dias: 30, nf: 'NF-100001', transp: 'TransRápida Logística', status: 'TRIAGEM_CONCLUIDA', obs: 'Estações de trabalho e servidor da agência Paulista, substituídos na modernização do parque.' },
    { id: ID.lote2, organizacaoId: ID.orgHospital, dias: 10, nf: 'NF-100002', transp: 'LogVerde Transportes', status: 'EM_TRIAGEM', obs: 'Impressora e roteador do setor de faturamento.' },
    { id: ID.lote3, organizacaoId: ID.orgBanco, dias: 2, nf: 'NF-100003', transp: 'TransRápida Logística', status: 'RECEBIDO', obs: 'Notebook devolvido por colaborador e fonte retirada do rack de rede.' }
  ] as const;

  for (const l of lotes) {
    await prisma.lote.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id,
        organizacaoId: l.organizacaoId,
        dataEntrada: diasAtras(l.dias),
        notaFiscal: l.nf,
        transportadora: l.transp,
        statusProcessamento: l.status,
        observacoes: l.obs
      }
    });
  }

  // tipo, marca, modelo, ano, estado, peso, lote, posição, status
  // O código de barras do equipamento é o próprio id (gerado aqui com UUID fixo, só para o seed ser repetível).
  const equipamentos = [
    ['NOTEBOOK', 'Dell', 'Latitude 5400', 2018, 'USADO_MODERADO', '1.900', ID.lote1, 1, 'AGUARDANDO_DESMONTE'],
    ['COMPUTADOR_MESA', 'HP', 'ProDesk 400', 2016, 'DANIFICADO_LEVE', '7.500', ID.lote1, 2, 'EM_DESMONTE'],
    ['MONITOR', 'LG', '22MK430', 2019, 'BOM_ESTADO', '3.200', ID.lote1, 3, 'PECAS_REAPROVEITADAS'],
    ['SERVIDOR', 'IBM', 'x3650', 2012, 'DANIFICADO_GRAVE', '22.000', ID.lote1, 4, 'DESCARTE_SEGURO'],
    ['IMPRESSORA', 'Epson', 'L3150', 2020, 'USADO_LEVE', '4.000', ID.lote2, 1, 'EM_TRIAGEM'],
    ['ROTEADOR', 'Cisco', 'RV340', 2017, 'USADO_MODERADO', '1.100', ID.lote2, 2, 'EM_TRIAGEM'],
    ['NOTEBOOK', 'Lenovo', 'ThinkPad T480', 2019, 'USADO_LEVE', '1.700', ID.lote3, 1, 'AGUARDANDO_TRIAGEM'],
    ['FONTE_ALIMENTACAO', 'Corsair', 'CV550', 2015, 'INSERVIVEL', '1.300', ID.lote3, 2, 'AGUARDANDO_TRIAGEM']
  ] as const;

  for (const [indice, [tipo, marca, modelo, ano, estado, peso, loteId, pos, status]] of equipamentos.entries()) {
    const idFixo = `00000000-0000-4000-8000-0000000000c${indice + 1}`;
    // Idempotente: localiza pela posição no lote (e não pelo código), assim também funciona em bancos já populados.
    const existente = await prisma.equipamento.findFirst({ where: { loteId, posicaoNoLote: pos } });
    let e;
    if (existente) {
      e = existente.codigoBarrasInterno === existente.id
        ? existente
        : await prisma.equipamento.update({ where: { id: existente.id }, data: { codigoBarrasInterno: existente.id } });
    } else {
      e = await prisma.equipamento.create({
        data: {
          id: idFixo,
          codigoBarrasInterno: idFixo,
          tipo,
          marca,
          modelo,
          anoFabricacao: ano,
          estadoFisico: estado,
          pesoQuilogramas: peso,
          loteId,
          posicaoNoLote: pos,
          statusRastreamento: status
        }
      });
    }

    // Histórico inicial: só cria se o equipamento ainda não tem movimentações.
    const jaTem = await prisma.movimentacao.count({ where: { equipamentoId: e.id } });
    if (jaTem === 0) {
      await prisma.movimentacao.create({
        data: {
          equipamentoId: e.id,
          origem: 'CLIENTE',
          destino: 'AGUARDANDO_TRIAGEM',
          responsavel: 'gestor',
          observacao: OBS_MOVIMENTO.AGUARDANDO_TRIAGEM
        }
      });
    }
  }
}

// AV3: massa de dados para as análises (eficiência, rentabilidade e vida útil). Dois lotes já bem processados,
// com idades e estados variados (assim a regressão da vida útil tem pontos suficientes por tipo) e o histórico
// de movimentações de cada equipamento, com horários espaçados.
type Linha = readonly [string, string, string, number, string, string, string]; // tipo, marca, modelo, ano, estado, peso, status final

const CAMINHOS: Record<string, string[]> = {
  AGUARDANDO_TRIAGEM: [],
  EM_TRIAGEM: ['EM_TRIAGEM'],
  AGUARDANDO_DESMONTE: ['EM_TRIAGEM', 'AGUARDANDO_DESMONTE'],
  EM_DESMONTE: ['EM_TRIAGEM', 'AGUARDANDO_DESMONTE', 'EM_DESMONTE'],
  PECAS_REAPROVEITADAS: ['EM_TRIAGEM', 'AGUARDANDO_DESMONTE', 'EM_DESMONTE', 'PECAS_REAPROVEITADAS'],
  MATERIAL_RECICLAVEL: ['EM_TRIAGEM', 'MATERIAL_RECICLAVEL'],
  DESCARTE_SEGURO: ['EM_TRIAGEM', 'DESCARTE_SEGURO'],
  BAIXA_DEFINITIVA: ['EM_TRIAGEM', 'AGUARDANDO_DESMONTE', 'EM_DESMONTE', 'PECAS_REAPROVEITADAS', 'BAIXA_DEFINITIVA']
};

const LOTE_4: Linha[] = [
  ['NOTEBOOK', 'Dell', 'Latitude 7490', 2021, 'BOM_ESTADO', '1.600', 'BAIXA_DEFINITIVA'],
  ['NOTEBOOK', 'HP', 'EliteBook 840', 2018, 'USADO_MODERADO', '1.800', 'PECAS_REAPROVEITADAS'],
  ['NOTEBOOK', 'Acer', 'Aspire 3', 2014, 'DANIFICADO_LEVE', '2.300', 'MATERIAL_RECICLAVEL'],
  ['NOTEBOOK', 'Samsung', 'NP300', 2011, 'DANIFICADO_GRAVE', '2.600', 'DESCARTE_SEGURO'],
  ['COMPUTADOR_MESA', 'Dell', 'OptiPlex 3020', 2019, 'USADO_LEVE', '7.200', 'PECAS_REAPROVEITADAS'],
  ['COMPUTADOR_MESA', 'Lenovo', 'ThinkCentre M72', 2015, 'USADO_MODERADO', '7.900', 'MATERIAL_RECICLAVEL'],
  ['COMPUTADOR_MESA', 'Positivo', 'Master D610', 2010, 'DANIFICADO_GRAVE', '8.400', 'DESCARTE_SEGURO'],
  ['MONITOR', 'LG', '19M38', 2020, 'BOM_ESTADO', '3.000', 'BAIXA_DEFINITIVA'],
  ['MONITOR', 'Samsung', 'S22F350', 2016, 'USADO_MODERADO', '3.800', 'MATERIAL_RECICLAVEL'],
  ['MONITOR', 'AOC', 'E970', 2009, 'INSERVIVEL', '5.500', 'DESCARTE_SEGURO'],
  ['IMPRESSORA', 'HP', 'LaserJet P1102', 2017, 'USADO_MODERADO', '5.000', 'MATERIAL_RECICLAVEL'],
  ['IMPRESSORA', 'Epson', 'L355', 2013, 'DANIFICADO_LEVE', '4.200', 'DESCARTE_SEGURO'],
  ['IMPRESSORA', 'Brother', 'HL-1202', 2021, 'USADO_LEVE', '4.100', 'EM_DESMONTE']
];

const LOTE_5: Linha[] = [
  ['SERVIDOR', 'Dell', 'PowerEdge R620', 2013, 'USADO_MODERADO', '18.000', 'PECAS_REAPROVEITADAS'],
  ['SERVIDOR', 'HP', 'ProLiant DL380', 2016, 'USADO_LEVE', '20.500', 'PECAS_REAPROVEITADAS'],
  ['SERVIDOR', 'IBM', 'x3550', 2010, 'DANIFICADO_GRAVE', '19.000', 'DESCARTE_SEGURO'],
  ['SERVIDOR', 'Dell', 'PowerEdge R740', 2022, 'BOM_ESTADO', '21.000', 'AGUARDANDO_DESMONTE'],
  ['ROTEADOR', 'Cisco', 'ISR 1100', 2019, 'BOM_ESTADO', '1.500', 'BAIXA_DEFINITIVA'],
  ['ROTEADOR', 'TP-Link', 'TL-WR940N', 2015, 'USADO_MODERADO', '0.600', 'MATERIAL_RECICLAVEL'],
  ['ROTEADOR', 'D-Link', 'DIR-615', 2011, 'DANIFICADO_LEVE', '0.500', 'DESCARTE_SEGURO'],
  ['FONTE_ALIMENTACAO', 'Corsair', 'VS450', 2018, 'USADO_LEVE', '1.200', 'MATERIAL_RECICLAVEL'],
  ['FONTE_ALIMENTACAO', 'Seasonic', 'S12II', 2012, 'DANIFICADO_LEVE', '1.400', 'MATERIAL_RECICLAVEL'],
  ['FONTE_ALIMENTACAO', 'Generic', 'ATX 500W', 2008, 'INSERVIVEL', '1.100', 'DESCARTE_SEGURO'],
  ['CABO_ESTRUTURADO', 'Furukawa', 'Cat6 caixa', 2020, 'BOM_ESTADO', '9.000', 'MATERIAL_RECICLAVEL'],
  ['CABO_ESTRUTURADO', 'Generic', 'Cat5e rolo', 2014, 'USADO_MODERADO', '8.500', 'MATERIAL_RECICLAVEL'],
  ['CABO_ESTRUTURADO', 'Generic', 'Cat5 rolo', 2008, 'DANIFICADO_LEVE', '8.000', 'DESCARTE_SEGURO']
];

// Lotes extras: deixam todas as telas com dados (lotes em cada situação, uma segunda empresa parceira com
// histórico completo, lote desativado). O status de cada lote segue a regra de derivação de src/regras/statusLote.ts.
const LOTE_6: Linha[] = [
  // Varejo: lote antigo, todo baixado -> FINALIZADO
  ['NOTEBOOK', 'Lenovo', 'IdeaPad 330', 2019, 'USADO_LEVE', '2.100', 'BAIXA_DEFINITIVA'],
  ['NOTEBOOK', 'Dell', 'Inspiron 15', 2017, 'USADO_MODERADO', '2.200', 'BAIXA_DEFINITIVA'],
  ['COMPUTADOR_MESA', 'HP', 'EliteDesk 800', 2018, 'BOM_ESTADO', '6.800', 'BAIXA_DEFINITIVA'],
  ['MONITOR', 'Dell', 'P2219H', 2019, 'BOM_ESTADO', '3.400', 'BAIXA_DEFINITIVA'],
  ['MONITOR', 'Philips', '221V8', 2020, 'USADO_LEVE', '2.900', 'BAIXA_DEFINITIVA'],
  ['IMPRESSORA', 'Canon', 'G3110', 2020, 'USADO_LEVE', '4.800', 'BAIXA_DEFINITIVA']
];

const LOTE_7: Linha[] = [
  // Varejo: lote em andamento, com destinos variados
  ['COMPUTADOR_MESA', 'Positivo', 'Master D3200', 2014, 'DANIFICADO_LEVE', '7.700', 'MATERIAL_RECICLAVEL'],
  ['COMPUTADOR_MESA', 'Dell', 'Vostro 3268', 2017, 'USADO_MODERADO', '7.100', 'EM_DESMONTE'],
  ['NOTEBOOK', 'Asus', 'VivoBook X510', 2018, 'DANIFICADO_GRAVE', '1.900', 'DESCARTE_SEGURO'],
  ['NOTEBOOK', 'Samsung', 'Book E30', 2021, 'BOM_ESTADO', '1.800', 'PECAS_REAPROVEITADAS'],
  ['MONITOR', 'AOC', '20E1H', 2016, 'USADO_MODERADO', '3.100', 'AGUARDANDO_DESMONTE'],
  ['IMPRESSORA', 'HP', 'DeskJet 2774', 2019, 'INSERVIVEL', '3.600', 'DESCARTE_SEGURO'],
  ['ROTEADOR', 'Intelbras', 'Action RF1200', 2020, 'USADO_LEVE', '0.400', 'EM_TRIAGEM'],
  ['FONTE_ALIMENTACAO', 'Gigabyte', 'P450B', 2019, 'USADO_LEVE', '1.250', 'MATERIAL_RECICLAVEL']
];

const LOTE_8: Linha[] = [
  // Varejo: recém-chegado -> RECEBIDO
  ['NOTEBOOK', 'Apple', 'MacBook Air A1466', 2017, 'USADO_MODERADO', '1.350', 'AGUARDANDO_TRIAGEM'],
  ['COMPUTADOR_MESA', 'Lenovo', 'ThinkCentre M720', 2019, 'USADO_LEVE', '6.500', 'AGUARDANDO_TRIAGEM'],
  ['MONITOR', 'Samsung', 'C24F390', 2018, 'BOM_ESTADO', '3.900', 'AGUARDANDO_TRIAGEM'],
  ['CABO_ESTRUTURADO', 'Furukawa', 'Cat6 sobras', 2019, 'USADO_LEVE', '6.000', 'AGUARDANDO_TRIAGEM']
];

const LOTE_9: Linha[] = [
  // Universidade: triagem concluída -> TRIAGEM_CONCLUIDA
  ['COMPUTADOR_MESA', 'Itautec', 'InfoWay ST4273', 2011, 'DANIFICADO_LEVE', '8.900', 'EM_TRIAGEM'],
  ['COMPUTADOR_MESA', 'Dell', 'OptiPlex 7010', 2013, 'USADO_MODERADO', '8.200', 'EM_TRIAGEM'],
  ['MONITOR', 'LG', 'W1943', 2010, 'DANIFICADO_GRAVE', '4.700', 'EM_TRIAGEM'],
  ['SERVIDOR', 'HP', 'ProLiant ML350', 2012, 'USADO_MODERADO', '24.000', 'EM_TRIAGEM'],
  ['IMPRESSORA', 'Xerox', 'Phaser 3020', 2016, 'USADO_MODERADO', '4.400', 'EM_TRIAGEM']
];

const LOTE_10: Linha[] = [
  // Hospital: recém-chegado -> RECEBIDO
  ['NOTEBOOK', 'HP', 'ProBook 440 G5', 2018, 'USADO_MODERADO', '1.750', 'AGUARDANDO_TRIAGEM'],
  ['MONITOR', 'Dell', 'E1916H', 2016, 'USADO_LEVE', '3.300', 'AGUARDANDO_TRIAGEM'],
  ['IMPRESSORA', 'Lexmark', 'MX421', 2015, 'DANIFICADO_LEVE', '18.500', 'AGUARDANDO_TRIAGEM']
];

const LOTE_11: Linha[] = [
  // Construtora (inativa): lote antigo, finalizado e desativado
  ['NOTEBOOK', 'Positivo', 'Motion Q232A', 2015, 'DANIFICADO_LEVE', '1.500', 'BAIXA_DEFINITIVA'],
  ['COMPUTADOR_MESA', 'Positivo', 'Master D580', 2012, 'USADO_MODERADO', '8.100', 'BAIXA_DEFINITIVA'],
  ['ROTEADOR', 'TP-Link', 'Archer C6', 2019, 'USADO_LEVE', '0.450', 'BAIXA_DEFINITIVA']
];

async function dadosAnaliticos() {
  const lotes = [
    { id: ID.lote4, organizacaoId: ID.orgHospital, dias: 70, nf: 'NF-100004', transp: 'LogVerde Transportes', status: 'EM_TRIAGEM', itens: LOTE_4, base: 1, obs: 'Renovação dos computadores e impressoras da recepção e dos consultórios.' },
    { id: ID.lote5, organizacaoId: ID.orgBanco, dias: 55, nf: 'NF-100005', transp: 'TransRápida Logística', status: 'TRIAGEM_CONCLUIDA', itens: LOTE_5, base: 101, obs: 'Servidores, rede e fontes do data center secundário desativado.' },
    { id: ID.lote6, organizacaoId: ID.orgVarejo, dias: 120, nf: 'NF-200101', transp: 'Rota Sul Cargas', status: 'FINALIZADO', itens: LOTE_6, base: 201, obs: 'Troca de parque das lojas da região metropolitana.' },
    { id: ID.lote7, organizacaoId: ID.orgVarejo, dias: 35, nf: 'NF-200102', transp: 'Rota Sul Cargas', status: 'EM_TRIAGEM', itens: LOTE_7, base: 301, obs: 'Equipamentos do centro de distribuição.' },
    { id: ID.lote8, organizacaoId: ID.orgVarejo, dias: 1, nf: 'NF-200103', transp: 'LogVerde Transportes', status: 'RECEBIDO', itens: LOTE_8, base: 401, obs: 'Coleta agendada da loja Centro.' },
    { id: ID.lote9, organizacaoId: ID.orgUniversidade, dias: 45, nf: 'NF-300201', transp: 'TransRápida Logística', status: 'TRIAGEM_CONCLUIDA', itens: LOTE_9, base: 501, obs: 'Laboratórios de informática do bloco B.' },
    { id: ID.lote10, organizacaoId: ID.orgHospital, dias: 4, nf: 'NF-100006', transp: 'LogVerde Transportes', status: 'RECEBIDO', itens: LOTE_10, base: 601, obs: 'Equipamentos da ala administrativa.' },
    { id: ID.lote11, organizacaoId: ID.orgConstrutora, dias: 210, nf: 'NF-400301', transp: 'Expresso Nordeste', status: 'FINALIZADO', itens: LOTE_11, base: 701, obs: 'Último lote antes do encerramento do contrato.', ativo: false }
  ] as const;

  // Lotes das organizações extras (só as que têm lote em dados-organizacoes.ts).
  const extras = ORGS_EXTRAS.flatMap((o, i) =>
    o.lote ? [{ id: idLoteExtra(i), organizacaoId: idOrgExtra(i), dias: o.lote.dias, nf: o.lote.nf, transp: o.lote.transp, status: o.lote.status, itens: o.lote.itens, base: 801 + i * 5, obs: o.lote.obs, ativo: o.ativo ?? true }] : []
  );

  for (const l of [...lotes, ...extras]) {
    const entrada = diasAtras(l.dias);
    await prisma.lote.upsert({
      where: { id: l.id },
      update: {},
      create: { id: l.id, organizacaoId: l.organizacaoId, dataEntrada: entrada, notaFiscal: l.nf, transportadora: l.transp, statusProcessamento: l.status as never, observacoes: l.obs, ativo: 'ativo' in l ? l.ativo : true }
    });

    for (const [i, [tipo, marca, modelo, ano, estado, peso, status]] of l.itens.entries()) {
      const id = `0000000d${String(l.base + i).padStart(4, '0')}`.padStart(12, '0');
      const idCompleto = `00000000-0000-4000-8000-${id}`;
      if (await prisma.equipamento.findUnique({ where: { id: idCompleto } })) continue;

      await prisma.equipamento.create({
        data: { id: idCompleto, codigoBarrasInterno: idCompleto, tipo: tipo as never, marca, modelo, anoFabricacao: ano, estadoFisico: estado as never, pesoQuilogramas: peso, loteId: l.id, posicaoNoLote: i + 1, statusRastreamento: status as never }
      });

      // Histórico: recebimento 1 h após a entrada e depois um passo a cada 6 a 30 horas (valores repetíveis).
      let momento = entrada.getTime() + 60 * 60 * 1000;
      let anterior = 'AGUARDANDO_TRIAGEM';
      const passos = [{ origem: 'CLIENTE', destino: 'AGUARDANDO_TRIAGEM' }, ...CAMINHOS[status].map((d) => ({ origem: '', destino: d }))];
      for (const [k, passo] of passos.entries()) {
        if (k > 0) momento += (6 + ((l.base + i + k * 7) % 25)) * 60 * 60 * 1000;
        await prisma.movimentacao.create({
          data: { equipamentoId: idCompleto, dataHora: new Date(momento), origem: passo.origem || anterior, destino: passo.destino, responsavel: 'gestor', observacao: OBS_MOVIMENTO[passo.destino] }
        });
        anterior = passo.destino;
      }
    }
  }
}

// Histórico de auditoria (journal) do cadastro inicial, para a tela de Auditoria já ter o que mostrar.
// Idempotente: só grava para registros que ainda não têm nenhuma linha no journal.
async function auditoriaInicial() {
  const idsOrgs = [ID.orgBanco, ID.orgHospital, ID.orgUniversidade, ID.orgVarejo, ID.orgConstrutora, ...ORGS_EXTRAS.map((_, i) => idOrgExtra(i))];
  const idsLotes = [ID.lote1, ID.lote2, ID.lote3, ID.lote4, ID.lote5, ID.lote6, ID.lote7, ID.lote8, ID.lote9, ID.lote10, ID.lote11, ...ORGS_EXTRAS.flatMap((o, i) => (o.lote ? [idLoteExtra(i)] : []))];
  const orgs = await prisma.organizacao.findMany({ where: { id: { in: idsOrgs } } });
  const lotes = await prisma.lote.findMany({ where: { id: { in: idsLotes } } });
  const semJournal = async (entidadeId: string) => (await prisma.journalTransacao.count({ where: { entidadeId } })) === 0;
  const json = (v: unknown) => JSON.parse(JSON.stringify(v));

  for (const o of orgs) {
    if (!(await semJournal(o.id))) continue;
    await prisma.journalTransacao.create({
      data: { timestamp: o.dataCadastro, operacao: 'CRIAR', entidade: 'Organizacao', entidadeId: o.id, dadosDepois: json({ ...o, ativo: true }), usuarioResponsavel: 'operador' }
    });
    if (!o.ativo) {
      await prisma.journalTransacao.create({
        data: { timestamp: diasAtras(15), operacao: 'STATUS', entidade: 'Organizacao', entidadeId: o.id, dadosAntes: { ativo: true }, dadosDepois: { ativo: false }, usuarioResponsavel: 'admin' }
      });
    }
  }
  for (const l of lotes) {
    if (!(await semJournal(l.id))) continue;
    await prisma.journalTransacao.create({
      data: { timestamp: l.dataEntrada, operacao: 'CRIAR', entidade: 'Lote', entidadeId: l.id, dadosDepois: json({ ...l, ativo: true }), usuarioResponsavel: 'gestor' }
    });
    if (!l.ativo) {
      await prisma.journalTransacao.create({
        data: { timestamp: diasAtras(16), operacao: 'STATUS', entidade: 'Lote', entidadeId: l.id, dadosAntes: { ativo: true }, dadosDepois: { ativo: false }, usuarioResponsavel: 'admin' }
      });
    }
  }
}

async function main() {
  await usuarios();
  await organizacoes();
  await lotesEEquipamentos();
  await dadosAnaliticos();
  await auditoriaInicial();
  const [nUsuarios, nOrgs, nInativas, nLotes, nEquip] = await Promise.all([
    prisma.usuario.count(), prisma.organizacao.count(), prisma.organizacao.count({ where: { ativo: false } }), prisma.lote.count(), prisma.equipamento.count()
  ]);
  console.log(`Seed concluído: ${nUsuarios} usuários, ${nOrgs} organizações (${nInativas} inativas), ${nLotes} lotes, ${nEquip} equipamentos.`);
  console.log('Logins: superusuario/Super@123, admin/Admin@123, operador/Operador@123, gestor/Gestor@123, auditor/Auditor@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// este trecho tem o dedo do Rossi.
