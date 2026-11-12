// Organizações clientes adicionais do seed (além das 5 principais). Dados fictícios, mas no formato de um
// cadastro real: razão social, CNPJ válido, inscrição estadual, endereço com CEP, telefone com DDD e e-mail.
// Os e-mails usam o domínio reservado ".example", que nunca entrega mensagens a empresas de verdade.
//
// cadastro: há quantos dias a organização foi cadastrada.
// contrato: null = sem contrato; venc < 0 = vencido há |venc| dias.
// lote: (opcional) um lote com os equipamentos e o status final de cada um, coerente com o status do lote.

export type Item = readonly [string, string, string, number, string, string, string]; // tipo, marca, modelo, ano, estado, peso, status final

export interface OrgExtra {
  razaoSocial: string;
  cnpjBase: string; // 8 dígitos; o seed completa com 0001 e os dígitos verificadores
  inscricaoEstadual: string;
  enderecoCompleto: string;
  telefone: string;
  email: string;
  cadastro: number;
  ativo?: boolean;
  contrato: { valor: string; assinatura: number; venc: number; auto: boolean; clausulas: string[] } | null;
  lote?: { dias: number; nf: string; transp: string; status: string; obs: string; itens: Item[] };
}

const C = {
  coleta: 'Coleta mensal programada de equipamentos eletrônicos.',
  coletaQuinzenal: 'Coleta quinzenal no endereço do cliente, com agendamento prévio.',
  certificado: 'Emissão de certificado de destinação ambiental.',
  rastreio: 'Rastreabilidade completa de cada equipamento.',
  dados: 'Destruição certificada de dados em discos e memórias, conforme a LGPD.',
  relatorio: 'Relatório trimestral de peso destinado por tipo de material.',
  logistica: 'Logística reversa de periféricos e cabos incluída no valor mensal.',
  multa: 'Multa de 2% ao mês em caso de atraso no pagamento.'
};

export const ORGS_EXTRAS: OrgExtra[] = [
  {
    razaoSocial: 'Transportadora Rota Sul Ltda', cnpjBase: '07345128', inscricaoEstadual: '0962274511',
    enderecoCompleto: 'Av. Assis Brasil, 8790 - Sarandi, Porto Alegre/RS - CEP 91140-001', telefone: '(51) 3364-2210', email: 'frota@rotasul.example', cadastro: 228,
    contrato: { valor: '6200.00', assinatura: 225, venc: 140, auto: true, clausulas: [C.coleta, C.certificado, C.rastreio] },
    lote: { dias: 40, nf: 'NF-210455', transp: 'Rota Sul Cargas', status: 'ENCAMINHADO', obs: 'Computadores de bordo e roteadores substituídos na renovação da frota.', itens: [
      ['ROTEADOR', 'Mikrotik', 'hAP ac2', 2018, 'USADO_MODERADO', '0.450', 'MATERIAL_RECICLAVEL'],
      ['ROTEADOR', 'TP-Link', 'Archer C20', 2017, 'DANIFICADO_LEVE', '0.380', 'MATERIAL_RECICLAVEL'],
      ['NOTEBOOK', 'Dell', 'Latitude 3490', 2018, 'DANIFICADO_LEVE', '1.950', 'MATERIAL_RECICLAVEL']
    ] }
  },
  {
    razaoSocial: 'Farmácia Bem Estar Comércio de Medicamentos Ltda', cnpjBase: '12589034', inscricaoEstadual: '244187905113',
    enderecoCompleto: 'Rua Barão de Jaguara, 1120 - Centro, Campinas/SP - CEP 13015-002', telefone: '(19) 3231-8840', email: 'administrativo@farmaciabemestar.example', cadastro: 224,
    contrato: { valor: '2150.00', assinatura: 220, venc: 210, auto: true, clausulas: [C.coleta, C.certificado] }
  },
  {
    razaoSocial: 'Colégio Novo Saber Ltda', cnpjBase: '20876451', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Rua Padre Anchieta, 455 - Mercês, Curitiba/PR - CEP 80410-030', telefone: '(41) 3338-1972', email: 'secretaria@colegionovosaber.example', cadastro: 219,
    contrato: { valor: '1800.00', assinatura: 215, venc: 95, auto: false, clausulas: [C.coleta, C.dados, C.certificado] },
    lote: { dias: 18, nf: 'NF-033182', transp: 'TransRápida Logística', status: 'TRIAGEM_CONCLUIDA', obs: 'Laboratório de informática do ensino médio, troca completa das máquinas.', itens: [
      ['COMPUTADOR_MESA', 'Positivo', 'Master D3400', 2015, 'USADO_MODERADO', '7.300', 'EM_TRIAGEM'],
      ['COMPUTADOR_MESA', 'Positivo', 'Master D3400', 2015, 'DANIFICADO_LEVE', '7.300', 'EM_TRIAGEM'],
      ['MONITOR', 'AOC', 'E2070SWN', 2016, 'USADO_MODERADO', '2.600', 'EM_TRIAGEM'],
      ['MONITOR', 'AOC', 'E2070SWN', 2016, 'USADO_LEVE', '2.600', 'EM_TRIAGEM']
    ] }
  },
  {
    razaoSocial: 'Metalúrgica Aço Forte Indústria e Comércio Ltda', cnpjBase: '31457692', inscricaoEstadual: '6261023458',
    enderecoCompleto: 'Rua Ângelo Dal Bó, 290 - Distrito Industrial, Caxias do Sul/RS - CEP 95112-375', telefone: '(54) 3209-4400', email: 'compras@acoforte.example', cadastro: 214,
    contrato: { valor: '4900.00', assinatura: 210, venc: 330, auto: true, clausulas: [C.coleta, C.relatorio, C.certificado, C.multa] }
  },
  {
    razaoSocial: 'Laticínios Serra Verde Ltda', cnpjBase: '04123987', inscricaoEstadual: '0012784560081',
    enderecoCompleto: 'Rodovia MG-050, km 112 - Zona Rural, Divinópolis/MG - CEP 35500-970', telefone: '(37) 3214-6630', email: 'ti@serraverde.example', cadastro: 209,
    contrato: { valor: '2700.00', assinatura: 205, venc: 160, auto: false, clausulas: [C.coletaQuinzenal, C.certificado] }
  },
  {
    razaoSocial: 'Clínica Odontológica Sorriso Pleno Ltda', cnpjBase: '18234560', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Av. Afonso Pena, 3500, sala 802 - Cruzeiro, Belo Horizonte/MG - CEP 30130-009', telefone: '(31) 3285-1210', email: 'gerencia@sorrisopleno.example', cadastro: 204,
    contrato: null
  },
  {
    razaoSocial: 'Supermercados Bom Preço Ltda', cnpjBase: '09876123', inscricaoEstadual: '0423318890014',
    enderecoCompleto: 'Av. Protásio Alves, 4120 - Petrópolis, Porto Alegre/RS - CEP 90410-006', telefone: '(51) 3331-9050', email: 'manutencao@bompreco.example', cadastro: 199,
    contrato: { valor: '9300.00', assinatura: 195, venc: 400, auto: true, clausulas: [C.coleta, C.logistica, C.certificado, C.rastreio] },
    lote: { dias: 3, nf: 'NF-781204', transp: 'Rota Sul Cargas', status: 'RECEBIDO', obs: 'Terminais de caixa e impressoras fiscais das lojas da zona norte.', itens: [
      ['COMPUTADOR_MESA', 'Bematech', 'RC-8400', 2016, 'USADO_MODERADO', '6.100', 'AGUARDANDO_TRIAGEM'],
      ['IMPRESSORA', 'Elgin', 'i9', 2018, 'DANIFICADO_LEVE', '1.800', 'AGUARDANDO_TRIAGEM'],
      ['IMPRESSORA', 'Epson', 'TM-T20', 2017, 'USADO_MODERADO', '1.700', 'AGUARDANDO_TRIAGEM'],
      ['MONITOR', 'Elo', '1515L', 2015, 'USADO_MODERADO', '3.500', 'AGUARDANDO_TRIAGEM']
    ] }
  },
  {
    razaoSocial: 'Agropecuária Campo Dourado Ltda', cnpjBase: '27654319', inscricaoEstadual: '131245678',
    enderecoCompleto: 'Rodovia BR-163, km 745 - Zona Rural, Sorriso/MT - CEP 78890-000', telefone: '(66) 3544-2817', email: 'escritorio@campodourado.example', cadastro: 194,
    contrato: { valor: '3100.00', assinatura: 190, venc: 75, auto: false, clausulas: [C.coleta, C.certificado] }
  },
  {
    razaoSocial: 'Escritório Contábil Precisão Ltda', cnpjBase: '15998734', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Rua Marechal Floriano Peixoto, 228, conj. 51 - Centro, Florianópolis/SC - CEP 88010-500', telefone: '(48) 3222-0748', email: 'contato@contabilprecisao.example', cadastro: 189,
    contrato: { valor: '950.00', assinatura: 185, venc: 180, auto: true, clausulas: [C.coleta, C.dados] }
  },
  {
    razaoSocial: 'Hotel Mar Azul Empreendimentos Ltda', cnpjBase: '33712845', inscricaoEstadual: '063418277',
    enderecoCompleto: 'Av. Beira Mar, 2900 - Meireles, Fortaleza/CE - CEP 60165-121', telefone: '(85) 3242-5500', email: 'manutencao@hotelmarazul.example', cadastro: 184,
    contrato: { valor: '3650.00', assinatura: 180, venc: 250, auto: true, clausulas: [C.coleta, C.certificado, C.rastreio] },
    lote: { dias: 60, nf: 'NF-004927', transp: 'Expresso Nordeste', status: 'FINALIZADO', obs: 'Televisores corporativos e computadores da recepção retirados na reforma.', itens: [
      ['COMPUTADOR_MESA', 'Lenovo', 'ThinkCentre M710q', 2017, 'USADO_LEVE', '1.300', 'BAIXA_DEFINITIVA'],
      ['MONITOR', 'Samsung', 'S24D300', 2016, 'USADO_MODERADO', '3.600', 'BAIXA_DEFINITIVA'],
      ['IMPRESSORA', 'HP', 'LaserJet Pro M402', 2017, 'USADO_MODERADO', '8.600', 'BAIXA_DEFINITIVA']
    ] }
  },
  {
    razaoSocial: 'Gráfica e Editora Página Certa Ltda', cnpjBase: '06543217', inscricaoEstadual: '116823904117',
    enderecoCompleto: 'Rua Javaés, 615 - Bom Retiro, São Paulo/SP - CEP 01130-010', telefone: '(11) 3331-6402', email: 'producao@paginacerta.example', cadastro: 179,
    contrato: { valor: '2480.00', assinatura: 175, venc: -12, auto: false, clausulas: [C.coleta, C.certificado] }
  },
  {
    razaoSocial: 'Cooperativa Agroindustrial Vale do Rio', cnpjBase: '78123654', inscricaoEstadual: '9045123370',
    enderecoCompleto: 'Av. Brasil, 1800 - Centro, Cascavel/PR - CEP 85801-000', telefone: '(45) 3220-3300', email: 'informatica@valedorio.example', cadastro: 174,
    contrato: { valor: '7800.00', assinatura: 170, venc: 360, auto: true, clausulas: [C.coleta, C.relatorio, C.certificado, C.rastreio] },
    lote: { dias: 25, nf: 'NF-120877', transp: 'TransRápida Logística', status: 'ENCAMINHADO', obs: 'Servidores do antigo data center da sede administrativa.', itens: [
      ['SERVIDOR', 'Dell', 'PowerEdge T430', 2016, 'USADO_MODERADO', '23.000', 'PECAS_REAPROVEITADAS'],
      ['SERVIDOR', 'HP', 'ProLiant ML110 Gen9', 2016, 'USADO_LEVE', '17.500', 'PECAS_REAPROVEITADAS'],
      ['FONTE_ALIMENTACAO', 'APC', 'Back-UPS 1200VA', 2015, 'DANIFICADO_LEVE', '9.700', 'PECAS_REAPROVEITADAS']
    ] }
  },
  {
    razaoSocial: 'Laboratório de Análises Clínicas Diagnóstica Ltda', cnpjBase: '22345619', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Rua General Osório, 760 - Centro, Ribeirão Preto/SP - CEP 14010-000', telefone: '(16) 3610-4475', email: 'qualidade@labdiagnostica.example', cadastro: 169,
    contrato: { valor: '1650.00', assinatura: 165, venc: 120, auto: true, clausulas: [C.coleta, C.dados, C.certificado] }
  },
  {
    razaoSocial: 'Seguradora Proteção Total S.A.', cnpjBase: '61234508', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Av. Rio Branco, 156, 18º andar - Centro, Rio de Janeiro/RJ - CEP 20040-901', telefone: '(21) 2533-7100', email: 'infraestrutura@protecaototal.example', cadastro: 164,
    contrato: { valor: '12400.00', assinatura: 160, venc: 500, auto: true, clausulas: [C.coleta, C.dados, C.certificado, C.rastreio, C.relatorio] },
    lote: { dias: 8, nf: 'NF-559013', transp: 'TransRápida Logística', status: 'RECEBIDO', obs: 'Notebooks devolvidos por colaboradores desligados e estações antigas da matriz.', itens: [
      ['NOTEBOOK', 'Lenovo', 'ThinkPad E14', 2020, 'USADO_LEVE', '1.700', 'AGUARDANDO_TRIAGEM'],
      ['NOTEBOOK', 'Dell', 'Latitude 5410', 2020, 'USADO_MODERADO', '1.600', 'AGUARDANDO_TRIAGEM'],
      ['NOTEBOOK', 'HP', 'ProBook 440 G7', 2020, 'DANIFICADO_LEVE', '1.600', 'AGUARDANDO_TRIAGEM'],
      ['COMPUTADOR_MESA', 'Dell', 'OptiPlex 5050', 2017, 'USADO_MODERADO', '5.200', 'AGUARDANDO_TRIAGEM']
    ] }
  },
  {
    razaoSocial: 'Indústria Têxtil Fio de Ouro Ltda', cnpjBase: '83456120', inscricaoEstadual: '254137896',
    enderecoCompleto: 'Rua Dr. Pedro Zimmermann, 4500 - Itoupava Central, Blumenau/SC - CEP 89068-000', telefone: '(47) 3337-1900', email: 'ti@fiodeouro.example', cadastro: 159,
    contrato: { valor: '4100.00', assinatura: 155, venc: 200, auto: false, clausulas: [C.coleta, C.certificado, C.multa] }
  },
  {
    razaoSocial: 'Rede de Postos Caminho Livre Ltda', cnpjBase: '41789235', inscricaoEstadual: '10654327800',
    enderecoCompleto: 'Rodovia BR-153, km 501 - Setor Perimetral, Goiânia/GO - CEP 74673-030', telefone: '(62) 3207-5544', email: 'financeiro@caminholivre.example', cadastro: 154,
    contrato: null
  },
  {
    razaoSocial: 'Advocacia Ribeiro & Martins Associados', cnpjBase: '13567890', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'SAUS Quadra 5, Bloco K, sala 1204 - Asa Sul, Brasília/DF - CEP 70070-050', telefone: '(61) 3322-8015', email: 'administrativo@ribeiromartins.example', cadastro: 149,
    contrato: { valor: '780.00', assinatura: 145, venc: 220, auto: true, clausulas: [C.coleta, C.dados] }
  },
  {
    razaoSocial: 'Distribuidora de Alimentos Sabor da Terra Ltda', cnpjBase: '26890134', inscricaoEstadual: '0753218840019',
    enderecoCompleto: 'Av. das Indústrias, 2300 - Navegantes, Porto Alegre/RS - CEP 90200-290', telefone: '(51) 3343-2770', email: 'logistica@sabordaterra.example', cadastro: 144,
    contrato: { valor: '3900.00', assinatura: 140, venc: 260, auto: true, clausulas: [C.coleta, C.logistica, C.certificado] }
  },
  {
    razaoSocial: 'Instituto de Ensino Técnico Futuro Ltda', cnpjBase: '35678901', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Rua da Aurora, 1025 - Boa Vista, Recife/PE - CEP 50050-000', telefone: '(81) 3423-6611', email: 'coordenacao@ietfuturo.example', cadastro: 139,
    contrato: { valor: '2050.00', assinatura: 135, venc: 90, auto: false, clausulas: [C.coleta, C.dados, C.certificado] },
    lote: { dias: 30, nf: 'NF-018346', transp: 'Expresso Nordeste', status: 'TRIAGEM_CONCLUIDA', obs: 'Equipamentos do laboratório de redes desativado.', itens: [
      ['ROTEADOR', 'Cisco', '1941', 2013, 'USADO_MODERADO', '5.400', 'EM_TRIAGEM'],
      ['ROTEADOR', 'Cisco', 'Catalyst 2960', 2012, 'USADO_MODERADO', '3.600', 'EM_TRIAGEM'],
      ['CABO_ESTRUTURADO', 'Furukawa', 'Cat5e patch cords', 2014, 'USADO_MODERADO', '4.200', 'EM_TRIAGEM']
    ] }
  },
  {
    razaoSocial: 'Construtora Pedra Firme Ltda', cnpjBase: '47890123', inscricaoEstadual: '2310045698',
    enderecoCompleto: 'Av. Tancredo Neves, 1632, sala 1501 - Caminho das Árvores, Salvador/BA - CEP 41820-020', telefone: '(71) 3272-4380', email: 'suprimentos@pedrafirme.example', cadastro: 134,
    ativo: false,
    contrato: { valor: '2600.00', assinatura: 130, venc: -30, auto: false, clausulas: [C.coleta, C.certificado] },
    lote: { dias: 100, nf: 'NF-402219', transp: 'Expresso Nordeste', status: 'FINALIZADO', obs: 'Equipamentos do canteiro de obras encerrado em Lauro de Freitas.', itens: [
      ['NOTEBOOK', 'Acer', 'Aspire 5', 2017, 'DANIFICADO_GRAVE', '2.200', 'BAIXA_DEFINITIVA'],
      ['IMPRESSORA', 'Brother', 'DCP-L2540DW', 2017, 'USADO_MODERADO', '11.300', 'BAIXA_DEFINITIVA']
    ] }
  },
  {
    razaoSocial: 'Móveis Planejados Casa Nobre Ltda', cnpjBase: '52901234', inscricaoEstadual: '9073456127',
    enderecoCompleto: 'Rua Tiradentes, 1450 - Centro, Arapongas/PR - CEP 86700-140', telefone: '(43) 3252-8890', email: 'contato@casanobre.example', cadastro: 129,
    contrato: { valor: '1350.00', assinatura: 125, venc: 150, auto: true, clausulas: [C.coletaQuinzenal, C.certificado] }
  },
  {
    razaoSocial: 'Clínica Médica Santa Clara Ltda', cnpjBase: '64012345', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Rua Padre Valdevino, 2475 - Aldeota, Fortaleza/CE - CEP 60135-041', telefone: '(85) 3261-9002', email: 'administracao@santaclara.example', cadastro: 124,
    contrato: { valor: '2300.00', assinatura: 120, venc: 240, auto: true, clausulas: [C.coleta, C.dados, C.certificado, C.rastreio] }
  },
  {
    razaoSocial: 'Logística Expresso Brasil Ltda', cnpjBase: '75123456', inscricaoEstadual: '336712049110',
    enderecoCompleto: 'Rod. Anhanguera, km 104 - Jardim Santa Mônica, Sumaré/SP - CEP 13181-903', telefone: '(19) 3803-2500', email: 'ti@expressobrasil.example', cadastro: 119,
    contrato: { valor: '8600.00', assinatura: 115, venc: 380, auto: true, clausulas: [C.coleta, C.logistica, C.relatorio, C.certificado] },
    lote: { dias: 50, nf: 'NF-660178', transp: 'TransRápida Logística', status: 'ENCAMINHADO', obs: 'Coletores de dados e impressoras de etiquetas do centro de distribuição.', itens: [
      ['IMPRESSORA', 'Zebra', 'ZT230', 2015, 'DANIFICADO_LEVE', '9.100', 'DESCARTE_SEGURO'],
      ['IMPRESSORA', 'Zebra', 'GC420t', 2014, 'DANIFICADO_GRAVE', '2.100', 'DESCARTE_SEGURO'],
      ['COMPUTADOR_MESA', 'HP', 'ProDesk 600 G1', 2014, 'INSERVIVEL', '6.900', 'DESCARTE_SEGURO']
    ] }
  },
  {
    razaoSocial: 'Panificadora Trigo Bom Ltda', cnpjBase: '86234567', inscricaoEstadual: '0627813455',
    enderecoCompleto: 'Rua Sete de Setembro, 980 - Centro, Juiz de Fora/MG - CEP 36010-120', telefone: '(32) 3215-4022', email: 'gerencia@trigobom.example', cadastro: 114,
    contrato: null
  },
  {
    razaoSocial: 'Cooperativa de Crédito União Regional', cnpjBase: '97345678', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Av. Getúlio Vargas, 2005 - Centro, Chapecó/SC - CEP 89812-000', telefone: '(49) 3321-6600', email: 'seguranca.informacao@uniaoregional.example', cadastro: 109,
    contrato: { valor: '5400.00', assinatura: 105, venc: 270, auto: true, clausulas: [C.coleta, C.dados, C.certificado, C.rastreio] },
    lote: { dias: 12, nf: 'NF-090361', transp: 'Rota Sul Cargas', status: 'TRIAGEM_CONCLUIDA', obs: 'Estações de atendimento das agências do oeste catarinense.', itens: [
      ['COMPUTADOR_MESA', 'Lenovo', 'ThinkCentre M720s', 2018, 'USADO_LEVE', '5.800', 'EM_TRIAGEM'],
      ['COMPUTADOR_MESA', 'Lenovo', 'ThinkCentre M720s', 2018, 'USADO_MODERADO', '5.800', 'EM_TRIAGEM'],
      ['MONITOR', 'Lenovo', 'ThinkVision E22', 2018, 'USADO_LEVE', '3.700', 'EM_TRIAGEM']
    ] }
  },
  {
    razaoSocial: 'Engenharia Elétrica Voltagem Ltda', cnpjBase: '10456789', inscricaoEstadual: '0912374568',
    enderecoCompleto: 'Rua Pedro Ivo, 333 - Centro, Joinville/SC - CEP 89201-100', telefone: '(47) 3433-1288', email: 'projetos@voltagem.example', cadastro: 104,
    contrato: { valor: '1900.00', assinatura: 100, venc: 130, auto: false, clausulas: [C.coleta, C.certificado] }
  },
  {
    razaoSocial: 'Atacadista Central do Norte Ltda', cnpjBase: '21567890', inscricaoEstadual: '041238907',
    enderecoCompleto: 'Av. Torquato Tapajós, 7200 - Colônia Terra Nova, Manaus/AM - CEP 69093-415', telefone: '(92) 3654-7700', email: 'compras@centralnorte.example', cadastro: 99,
    contrato: { valor: '6700.00', assinatura: 95, venc: 310, auto: true, clausulas: [C.coleta, C.logistica, C.certificado] }
  },
  {
    razaoSocial: 'Faculdade Integrada Horizonte Ltda', cnpjBase: '32678901', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Rua Teresina, 1170 - Adrianópolis, Manaus/AM - CEP 69057-070', telefone: '(92) 3642-3010', email: 'patrimonio@fihorizonte.example', cadastro: 94,
    contrato: { valor: '4450.00', assinatura: 90, venc: 280, auto: true, clausulas: [C.coleta, C.dados, C.certificado, C.relatorio] }
  },
  {
    razaoSocial: 'Indústria de Embalagens Plastipack Ltda', cnpjBase: '43789012', inscricaoEstadual: '286415230117',
    enderecoCompleto: 'Av. Industrial, 1450 - Distrito Industrial, Sorocaba/SP - CEP 18087-180', telefone: '(15) 3325-9200', email: 'manutencao@plastipack.example', cadastro: 89,
    contrato: { valor: '3300.00', assinatura: 85, venc: 190, auto: true, clausulas: [C.coleta, C.relatorio, C.certificado] },
    lote: { dias: 6, nf: 'NF-317840', transp: 'TransRápida Logística', status: 'RECEBIDO', obs: 'Painéis de controle e computadores da linha de extrusão.', itens: [
      ['COMPUTADOR_MESA', 'Advantech', 'IPC-610', 2014, 'DANIFICADO_LEVE', '14.000', 'AGUARDANDO_TRIAGEM'],
      ['MONITOR', 'Dell', 'P1914S', 2014, 'USADO_MODERADO', '4.900', 'AGUARDANDO_TRIAGEM'],
      ['FONTE_ALIMENTACAO', 'SMS', 'Net 4+ 1400VA', 2016, 'INSERVIVEL', '10.200', 'AGUARDANDO_TRIAGEM']
    ] }
  },
  {
    razaoSocial: 'Concessionária Via Norte Veículos Ltda', cnpjBase: '54890123', inscricaoEstadual: '7019845231',
    enderecoCompleto: 'Av. Augusto Montenegro, 4300 - Parque Verde, Belém/PA - CEP 66635-110', telefone: '(91) 3248-6000', email: 'administrativo@vianorte.example', cadastro: 84,
    contrato: { valor: '2850.00', assinatura: 80, venc: 170, auto: false, clausulas: [C.coleta, C.certificado] }
  },
  {
    razaoSocial: 'Imobiliária Lar Seguro Ltda', cnpjBase: '65901234', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Rua Visconde de Pirajá, 414, sala 708 - Ipanema, Rio de Janeiro/RJ - CEP 22410-002', telefone: '(21) 2247-3150', email: 'contato@larseguro.example', cadastro: 79,
    contrato: null
  },
  {
    razaoSocial: 'Hospital Regional São Lucas Ltda', cnpjBase: '76012345', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Av. Presidente Kennedy, 1500 - Centro, Campo Grande/MS - CEP 79002-370', telefone: '(67) 3318-4000', email: 'engenharia.clinica@saolucas.example', cadastro: 74,
    contrato: { valor: '10200.00', assinatura: 70, venc: 450, auto: true, clausulas: [C.coleta, C.dados, C.certificado, C.rastreio, C.relatorio] },
    lote: { dias: 15, nf: 'NF-245593', transp: 'LogVerde Transportes', status: 'ENCAMINHADO', obs: 'Estações dos postos de enfermagem substituídas na informatização dos leitos.', itens: [
      ['COMPUTADOR_MESA', 'Dell', 'OptiPlex 3040', 2016, 'USADO_MODERADO', '5.600', 'AGUARDANDO_DESMONTE'],
      ['COMPUTADOR_MESA', 'Dell', 'OptiPlex 3040', 2016, 'USADO_LEVE', '5.600', 'AGUARDANDO_DESMONTE'],
      ['NOTEBOOK', 'Lenovo', 'ThinkPad L460', 2016, 'DANIFICADO_LEVE', '2.000', 'AGUARDANDO_DESMONTE']
    ] }
  },
  {
    razaoSocial: 'Calçados Passo Firme Indústria Ltda', cnpjBase: '87123456', inscricaoEstadual: '0582310477',
    enderecoCompleto: 'Rua Bento Gonçalves, 3200 - Centro, Novo Hamburgo/RS - CEP 93410-003', telefone: '(51) 3594-1830', email: 'ti@passofirme.example', cadastro: 69,
    contrato: { valor: '3700.00', assinatura: 65, venc: 230, auto: true, clausulas: [C.coleta, C.certificado, C.rastreio] }
  },
  {
    razaoSocial: 'Telecom Conecta Serviços de Internet Ltda', cnpjBase: '98234567', inscricaoEstadual: '0831276540',
    enderecoCompleto: 'Rua Coronel Pedro Benedet, 190 - Centro, Criciúma/SC - CEP 88801-250', telefone: '(48) 3437-2020', email: 'noc@conectatelecom.example', cadastro: 64,
    contrato: { valor: '5100.00', assinatura: 60, venc: 300, auto: true, clausulas: [C.coleta, C.logistica, C.certificado, C.rastreio] },
    lote: { dias: 22, nf: 'NF-701126', transp: 'Rota Sul Cargas', status: 'TRIAGEM_CONCLUIDA', obs: 'Roteadores e cabos recolhidos de clientes que cancelaram o serviço.', itens: [
      ['ROTEADOR', 'Intelbras', 'W5-1200F', 2019, 'USADO_MODERADO', '0.420', 'EM_TRIAGEM'],
      ['ROTEADOR', 'Huawei', 'HG8245H', 2018, 'USADO_MODERADO', '0.390', 'EM_TRIAGEM'],
      ['ROTEADOR', 'ZTE', 'F670L', 2019, 'DANIFICADO_LEVE', '0.400', 'EM_TRIAGEM'],
      ['CABO_ESTRUTURADO', 'Nexans', 'Drop óptico', 2019, 'USADO_MODERADO', '12.500', 'EM_TRIAGEM']
    ] }
  },
  {
    razaoSocial: 'Consórcio Intermunicipal de Saúde Vale Verde', cnpjBase: '11345678', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Rua Benjamin Constant, 640 - Centro, Lages/SC - CEP 88501-110', telefone: '(49) 3222-7410', email: 'administracao@cisvaleverde.example', cadastro: 59,
    contrato: { valor: '2950.00', assinatura: 55, venc: 310, auto: false, clausulas: [C.coleta, C.dados, C.certificado] }
  },
  {
    razaoSocial: 'Restaurantes Sabor Caseiro Ltda', cnpjBase: '22456789', inscricaoEstadual: '0012336578',
    enderecoCompleto: 'Rua Halfeld, 505 - Centro, Juiz de Fora/MG - CEP 36010-002', telefone: '(32) 3213-6655', email: 'gerencia@saborcaseiro.example', cadastro: 54,
    ativo: false,
    contrato: { valor: '690.00', assinatura: 50, venc: -5, auto: false, clausulas: [C.coletaQuinzenal] }
  },
  {
    razaoSocial: 'Química Industrial Pura Ltda', cnpjBase: '33567890', inscricaoEstadual: '6340018925',
    enderecoCompleto: 'Rua Pernambuco, 1200 - Polo Petroquímico, Camaçari/BA - CEP 42810-000', telefone: '(71) 3634-8800', email: 'compras@quimicapura.example', cadastro: 49,
    contrato: { valor: '4600.00', assinatura: 45, venc: 320, auto: true, clausulas: [C.coleta, C.relatorio, C.certificado, C.multa] }
  },
  {
    razaoSocial: 'Editora Saber e Cultura Ltda', cnpjBase: '44678901', inscricaoEstadual: '148209766114',
    enderecoCompleto: 'Rua Cardeal Arcoverde, 2365 - Pinheiros, São Paulo/SP - CEP 05407-003', telefone: '(11) 3816-4500', email: 'administrativo@sabercultura.example', cadastro: 44,
    contrato: { valor: '1450.00', assinatura: 40, venc: 325, auto: true, clausulas: [C.coleta, C.certificado] }
  },
  {
    razaoSocial: 'Usina de Energia Solar Sol Nascente S.A.', cnpjBase: '55789012', inscricaoEstadual: '201457893',
    enderecoCompleto: 'Rodovia BR-232, km 210 - Zona Rural, Arcoverde/PE - CEP 56500-000', telefone: '(87) 3821-5050', email: 'operacao@solnascente.example', cadastro: 39,
    contrato: { valor: '5900.00', assinatura: 35, venc: 330, auto: true, clausulas: [C.coleta, C.logistica, C.relatorio, C.certificado] },
    lote: { dias: 5, nf: 'NF-008821', transp: 'Expresso Nordeste', status: 'RECEBIDO', obs: 'Inversores de monitoramento e cabeamento da subestação.', itens: [
      ['FONTE_ALIMENTACAO', 'Fronius', 'Datamanager', 2017, 'DANIFICADO_LEVE', '2.300', 'AGUARDANDO_TRIAGEM'],
      ['CABO_ESTRUTURADO', 'Prysmian', 'Cabo de dados blindado', 2017, 'USADO_MODERADO', '15.000', 'AGUARDANDO_TRIAGEM']
    ] }
  },
  {
    razaoSocial: 'Escola de Idiomas Mundo Aberto Ltda', cnpjBase: '66890123', inscricaoEstadual: 'ISENTO',
    enderecoCompleto: 'Av. Higienópolis, 890 - Centro, Londrina/PR - CEP 86020-080', telefone: '(43) 3324-7788', email: 'secretaria@mundoaberto.example', cadastro: 34,
    contrato: null
  },
  {
    razaoSocial: 'Frigorífico Boi Gordo Ltda', cnpjBase: '77901234', inscricaoEstadual: '283104572',
    enderecoCompleto: 'Rodovia BR-364, km 12 - Distrito Industrial, Rondonópolis/MT - CEP 78740-275', telefone: '(66) 3423-9100', email: 'ti@boigordo.example', cadastro: 29,
    contrato: { valor: '4250.00', assinatura: 25, venc: 340, auto: true, clausulas: [C.coleta, C.certificado, C.rastreio] }
  },
  {
    razaoSocial: 'Papelaria e Suprimentos Escritório Total Ltda', cnpjBase: '88012345', inscricaoEstadual: '0623987114',
    enderecoCompleto: 'Rua Andradas, 1340 - Centro Histórico, Porto Alegre/RS - CEP 90020-008', telefone: '(51) 3225-1407', email: 'loja@escritoriototal.example', cadastro: 24,
    contrato: { valor: '880.00', assinatura: 20, venc: 345, auto: false, clausulas: [C.coletaQuinzenal, C.certificado] }
  }
];
