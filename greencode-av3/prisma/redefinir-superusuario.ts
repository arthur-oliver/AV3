// Recuperação de emergência: redefine a senha do superusuário (e reativa a conta, se estiver desativada).
// Quem roda precisa ter acesso ao servidor e ao arquivo .env.
// Uso: npm run superusuario:redefinir -- NovaSenha@123
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const nova = process.argv[2];
  if (!nova || nova.length < 8 || nova.length > 72) {
    console.error('Informe a nova senha (8 a 72 caracteres): npm run superusuario:redefinir -- NovaSenha@123');
    process.exit(1);
  }
  const alvo = await prisma.usuario.findFirst({ where: { papel: 'SUPERUSUARIO' } });
  if (!alvo) {
    console.error('Nenhum superusuário encontrado. Rode o seed: npm run db:seed');
    process.exit(1);
  }
  const senhaHash = await bcrypt.hash(nova, 10);
  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id: alvo.id }, data: { senhaHash, ativo: true, versao: { increment: 1 } } });
    await tx.journalTransacao.create({
      data: { operacao: 'ATUALIZAR', entidade: 'Usuario', entidadeId: alvo.id, dadosDepois: { campo: 'senha', redefinidaPor: 'script-de-recuperacao' }, usuarioResponsavel: 'script-de-recuperacao' }
    });
  });
  console.log(`Senha do superusuário "${alvo.usuario}" redefinida e conta ativa.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Oliver passou por aqui.
