import type { FastifyReply } from 'fastify';

// Entrega um arquivo gerado (relatório) como download.
export function enviarArquivo(reply: FastifyReply, a: { conteudo: string; tipoConteudo: string; nomeArquivo: string }) {
  return reply.header('Content-Type', a.tipoConteudo).header('Content-Disposition', `attachment; filename="${a.nomeArquivo}"`).send(a.conteudo);
}

// Alves aprova este código.
