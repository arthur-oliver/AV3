// Cria uma chave de API de demonstração para uma organização do seed e a imprime (aparece só desta vez).
// Uso: npm run chave:demo            (organização padrão: Banco Horizonte, permissões de leitura e relatórios)
//      npm run chave:demo -- --escrita   (inclui a permissão de registrar lotes)
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { gerarChave } from '../src/seguranca/chaveApi';

const prisma = new PrismaClient();
const ORGANIZACAO_DEMO = '00000000-0000-4000-8000-0000000000a1';

async function main() {
  const escrita = process.argv.includes('--escrita');
  const org = await prisma.organizacao.findUnique({ where: { id: ORGANIZACAO_DEMO } });
  if (!org) {
    console.error('Organização de demonstração não encontrada. Rode o seed: npm run db:seed');
    process.exit(1);
  }
  const { chave, prefixo, hash } = gerarChave();
  const permissoes = ['LER_RASTREABILIDADE', 'LER_RELATORIOS', ...(escrita ? ['ESCREVER_LOTES'] : [])];
  await prisma.chaveApi.create({
    data: { nome: 'Chave de demonstração', organizacaoId: org.id, prefixo, hashChave: hash, permissoes, limitePorMinuto: 60, criadoPor: 'script-demo' }
  });
  console.log(`Organização: ${org.razaoSocial}`);
  console.log(`Permissões:  ${permissoes.join(', ')}`);
  console.log(`Chave:       ${chave}`);
  console.log('Use no cabeçalho X-API-Key. Ela não será exibida novamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Alves aprova este código.
