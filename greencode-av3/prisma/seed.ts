// Carga inicial de dados (seed). Idempotente: pode rodar várias vezes sem duplicar registros.
// Execução: npm run db:seed
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const diasAtras = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const emDias = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

// IDs fixos só para o seed ser repetível.
const ID = {
  orgBanco: '00000000-0000-4000-8000-0000000000a1',
  orgHospital: '00000000-0000-4000-8000-0000000000a2',
  orgUniversidade: '00000000-0000-4000-8000-0000000000a3',
  lote1: '00000000-0000-4000-8000-0000000000b1',
  lote2: '00000000-0000-4000-8000-0000000000b2',
  lote3: '00000000-0000-4000-8000-0000000000b3',
  lote4: '00000000-0000-4000-8000-0000000000b4',
  lote5: '00000000-0000-4000-8000-0000000000b5'
};

async function usuarios() {
  const lista = [
    { usuario: 'superusuario', nome: 'Superusuário', senha: 'Super@123', papel: 'SUPERUSUARIO' },
    { usuario: 'admin', nome: 'Administrador', senha: 'Admin@123', papel: 'ADMINISTRADOR' },
    { usuario: 'operador', nome: 'Operador de Cadastro', senha: 'Operador@123', papel: 'OPERADOR_CADASTRO' },
    { usuario: 'gestor', nome: 'Gestor de Almoxarifado', senha: 'Gestor@123', papel: 'GESTOR_ALMOXARIFADO' },
    { usuario: 'auditor', nome: 'Auditor', senha: 'Auditor@123', papel: 'AUDITOR' }
  ] as const;

  for (const u of lista) {
    await prisma.usuario.upsert({
      where: { usuario: u.usuario },
      update: {},
      create: { usuario: u.usuario, nome: u.nome, senhaHash: await bcrypt.hash(u.senha, 10), papel: u.papel }
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
      enderecoCompleto: 'Av. Paulista, 1000 - São Paulo/SP',
      telefone: '(11) 3000-1000',
      email: 'ti@bancohorizonte.example',
      contrato: { valor: '15000.00', venc: emDias(300), auto: true }
    },
    {
      id: ID.orgHospital,
      razaoSocial: 'Hospital Vida Plena',
      cnpj: '45678912000155',
      inscricaoEstadual: 'ISENTO',
      enderecoCompleto: 'Rua das Flores, 200 - Curitiba/PR',
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
      enderecoCompleto: 'Campus Central - Belo Horizonte/MG',
      telefone: '(31) 3000-3000',
      email: 'patrimonio@ufexemplo.example',
      contrato: null
    }
  ];

  for (const o of orgs) {
    const { contrato, ...dados } = o;
    await prisma.organizacao.upsert({ where: { id: o.id }, update: {}, create: dados });
    if (contrato) {
      await prisma.contrato.upsert({
        where: { organizacaoId: o.id },
        update: {},
        create: {
          organizacaoId: o.id,
          dataAssinatura: diasAtras(60),
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
    { id: ID.lote1, organizacaoId: ID.orgBanco, dias: 30, nf: 'NF-100001', transp: 'TransRapida', status: 'TRIAGEM_CONCLUIDA' },
    { id: ID.lote2, organizacaoId: ID.orgHospital, dias: 10, nf: 'NF-100002', transp: 'LogVerde', status: 'EM_TRIAGEM' },
    { id: ID.lote3, organizacaoId: ID.orgBanco, dias: 2, nf: 'NF-100003', transp: 'TransRapida', status: 'RECEBIDO' }
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
        observacoes: 'Lote gerado pelo seed.'
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
          observacao: 'Recebimento do lote (seed).'
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

async function dadosAnaliticos() {
  const lotes = [
    { id: ID.lote4, organizacaoId: ID.orgHospital, dias: 70, nf: 'NF-100004', transp: 'LogVerde', status: 'EM_TRIAGEM', itens: LOTE_4, base: 1 },
    { id: ID.lote5, organizacaoId: ID.orgBanco, dias: 55, nf: 'NF-100005', transp: 'TransRapida', status: 'TRIAGEM_CONCLUIDA', itens: LOTE_5, base: 101 }
  ] as const;

  for (const l of lotes) {
    const entrada = diasAtras(l.dias);
    await prisma.lote.upsert({
      where: { id: l.id },
      update: {},
      create: { id: l.id, organizacaoId: l.organizacaoId, dataEntrada: entrada, notaFiscal: l.nf, transportadora: l.transp, statusProcessamento: l.status, observacoes: 'Lote gerado pelo seed (massa para análises).' }
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
          data: { equipamentoId: idCompleto, dataHora: new Date(momento), origem: passo.origem || anterior, destino: passo.destino, responsavel: 'gestor', observacao: 'Movimentação gerada pelo seed.' }
        });
        anterior = passo.destino;
      }
    }
  }
}

async function main() {
  await usuarios();
  await organizacoes();
  await lotesEEquipamentos();
  await dadosAnaliticos();
  console.log('Seed concluído: 5 usuários, 3 organizações, 5 lotes, 34 equipamentos.');
  console.log('Logins: superusuario/Super@123, admin/Admin@123, operador/Operador@123, gestor/Gestor@123, auditor/Auditor@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// este trecho tem o dedo do Rossi.
