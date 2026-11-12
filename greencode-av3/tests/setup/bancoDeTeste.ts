// Preparação global do "npm test": os testes de integração rodam num banco SEPARADO (ver urlBancoTeste.ts),
// recriado do zero a cada execução. Assim os registros criados pelos testes nunca aparecem no portal,
// e cada execução começa exatamente do estado do seed.
//
// Passos: cria o banco de teste (se ainda não existir) -> aplica as migrações -> esvazia as tabelas -> roda o seed.
import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { nomeBanco, urlBancoPrincipal, urlBancoTeste } from './urlBancoTeste';

function rodar(comando: string, url: string) {
  try {
    execSync(comando, { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  } catch (e) {
    const err = e as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(`Falha ao preparar o banco de teste (${comando}):\n${err.stdout ?? ''}${err.stderr ?? ''}`);
  }
}

export default async function prepararBancoDeTeste() {
  const url = urlBancoTeste();
  const nome = nomeBanco(url);

  // 1) Cria o banco de teste usando a conexão do banco principal (mesmo servidor e usuário).
  const principal = new PrismaClient({ datasourceUrl: urlBancoPrincipal() });
  try {
    await principal.$executeRawUnsafe(`CREATE DATABASE IF NOT EXISTS \`${nome.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await principal.$disconnect();
  }

  // 2) Estrutura atualizada.
  rodar('npx prisma migrate deploy', url);

  // 3) Esvazia todas as tabelas (menos o controle de migrações).
  const teste = new PrismaClient({ datasourceUrl: url });
  try {
    const tabelas = await teste.$queryRawUnsafe<{ nome: string }[]>(
      "SELECT TABLE_NAME AS nome FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_prisma_migrations'"
    );
    await teste.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
      for (const { nome: t } of tabelas) await tx.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``);
      await tx.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    });
  } finally {
    await teste.$disconnect();
  }

  // 4) Dados de exemplo (os mesmos do portal).
  rodar('npx tsx prisma/seed.ts', url);
}
