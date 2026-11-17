import { lerPaginacao, montarPagina } from '../utils/paginacao';
import { prisma } from '../lib/prisma';
import { UsuarioRepositorio } from '../repositorios/UsuarioRepositorio';
import { gerarHashSenha } from '../seguranca/senha';
import { Conflito, NaoEncontrado, RegraNegocio } from '../erros/AppError';
import { registrarJournal } from '../utils/auditoria';
import { exigirAtualizacao } from '../utils/versao';
import { exigirContinuidadeDoPapel, exigirNaoSuperusuario, exigirPapelAtribuivel, validarNome } from '../regras/usuarios';
import { controleLogin } from '../seguranca/tentativasLogin';
import { validarForcaSenha } from './AuthServico';
import type { PapelUsuario } from '../dominio/enums';

type Responsavel = { id: string; usuario: string };

// Gestão de contas de acesso. Somente o SUPERUSUARIO (único) chama estes métodos pelas rotas /usuarios;
// qualquer usuário logado só altera o PRÓPRIO nome (atualizarNome) e a PRÓPRIA senha (AuthServico).
//
// Regras de proteção (pensadas para o sistema nunca ficar "trancado"):
//  - o superusuário é único: ninguém cria, atribui, rebaixa, desativa ou exclui esse papel;
//  - sempre sobra ao menos 1 usuário ATIVO em cada papel essencial (administrador, operador, gestor);
//  - ninguém desativa, exclui ou muda o próprio papel (evita se trancar para fora por engano);
//  - o superusuário pode excluir qualquer outra conta, mesmo com histórico: journal e movimentações guardam o login em
//    texto (sem chave estrangeira), então os registros continuam íntegros e legíveis depois da exclusão;
//  - o login (nome de usuário) não muda, pois ele identifica o responsável nos registros históricos.
export class UsuarioServico {
  constructor(private readonly usuarios = new UsuarioRepositorio()) {}

  async listar(filtro: { papel?: PapelUsuario; ativo?: boolean; pagina?: number; limite?: number } = {}) {
    const pag = lerPaginacao(filtro);
    const [itens, total] = await this.usuarios.listar({ papel: filtro.papel, ativo: filtro.ativo }, pag);
    return montarPagina(itens, total, pag);
  }

  async buscar(id: string) {
    const u = await this.usuarios.buscarPublicoPorId(id);
    if (!u) throw new NaoEncontrado('Usuário');
    return u;
  }

  async criar(dados: { usuario: string; nome?: string; senha: string; papel: PapelUsuario }, responsavel: string) {
    exigirPapelAtribuivel(dados.papel);
    validarForcaSenha(dados.senha);
    const nome = dados.nome === undefined ? '' : validarNome(dados.nome);
    if (await this.usuarios.buscarPorLogin(dados.usuario)) {
      throw new Conflito('Já existe um usuário com este login.');
    }
    const senhaHash = await gerarHashSenha(dados.senha);

    return prisma.$transaction(async (tx) => {
      const criado = await this.usuarios.criar({ usuario: dados.usuario, nome, senhaHash, papel: dados.papel, trocaSenhaObrigatoria: true }, tx);
      await registrarJournal(tx, {
        operacao: 'CRIAR',
        entidade: 'Usuario',
        entidadeId: criado.id,
        dadosDepois: criado,
        usuario: responsavel
      });
      return criado;
    });
  }

  // Troca o papel do usuário (ex.: de OPERADOR_CADASTRO para GESTOR_ALMOXARIFADO).
  async alterarPapel(id: string, papel: PapelUsuario, versao: number, responsavel: Responsavel) {
    if (id === responsavel.id) {
      throw new RegraNegocio('Ninguém altera o próprio papel.');
    }
    exigirPapelAtribuivel(papel);
    return prisma.$transaction(async (tx) => {
      const alvoAntes = await this.usuarios.buscarPorId(id, tx);
      if (!alvoAntes) throw new NaoEncontrado('Usuário');
      exigirNaoSuperusuario(alvoAntes.papel, 'alterar o papel deste usuário');
      if (alvoAntes.papel === papel) throw new RegraNegocio('O usuário já possui este papel.');

      if (alvoAntes.ativo) {
        const ativos = await this.usuarios.bloquearAtivosDoPapel(alvoAntes.papel, tx);
        exigirContinuidadeDoPapel(alvoAntes.papel, ativos, id, 'trocar o papel deste usuário');
      }
      exigirAtualizacao(await this.usuarios.atualizarComVersao(id, versao, { papel }, tx), true, 'Usuário');

      const depois = (await this.usuarios.buscarPublicoPorId(id, tx))!;
      await registrarJournal(tx, {
        operacao: 'ATUALIZAR',
        entidade: 'Usuario',
        entidadeId: id,
        dadosAntes: { papel: alvoAntes.papel },
        dadosDepois: { papel },
        usuario: responsavel.usuario
      });
      return depois;
    });
  }

  async alterarAtivo(id: string, ativo: boolean, responsavel: Responsavel) {
    if (id === responsavel.id && !ativo) {
      throw new RegraNegocio('Você não pode desativar a sua própria conta.');
    }
    return prisma.$transaction(async (tx) => {
      const atual = await this.usuarios.buscarPorId(id, tx);
      if (!atual) throw new NaoEncontrado('Usuário');
      if (!ativo) exigirNaoSuperusuario(atual.papel, 'desativar este usuário');
      if (atual.ativo === ativo) return (await this.usuarios.buscarPublicoPorId(id, tx))!; // nada a fazer

      if (!ativo) {
        const ativos = await this.usuarios.bloquearAtivosDoPapel(atual.papel, tx);
        exigirContinuidadeDoPapel(atual.papel, ativos, id, 'desativar este usuário');
      }
      const novo = await this.usuarios.atualizar(id, { ativo }, tx);
      await registrarJournal(tx, {
        operacao: 'ATUALIZAR',
        entidade: 'Usuario',
        entidadeId: id,
        dadosAntes: { ativo: atual.ativo },
        dadosDepois: { ativo },
        usuario: responsavel.usuario
      });
      return novo;
    });
  }

  // Troca o nome de exibição. O superusuário altera o de qualquer conta; cada usuário altera o próprio.
  // O login (campo "usuario") não muda, pois identifica o responsável nos registros históricos.
  async atualizarNome(id: string, nome: string, versao: number, responsavel: Responsavel) {
    const limpo = validarNome(nome);
    return prisma.$transaction(async (tx) => {
      const antes = await this.usuarios.buscarPorId(id, tx);
      if (!antes) throw new NaoEncontrado('Usuário');
      exigirAtualizacao(await this.usuarios.atualizarComVersao(id, versao, { nome: limpo }, tx), true, 'Usuário');
      await registrarJournal(tx, {
        operacao: 'ATUALIZAR',
        entidade: 'Usuario',
        entidadeId: id,
        dadosAntes: { nome: antes.nome },
        dadosDepois: { nome: limpo },
        usuario: responsavel.usuario
      });
      return (await this.usuarios.buscarPublicoPorId(id, tx))!;
    });
  }

  // O superusuário define uma senha PROVISÓRIA (por exemplo, quando alguém esquece a própria): no próximo
  // login a pessoa é obrigada a escolher uma senha só dela.
  async redefinirSenha(id: string, novaSenha: string, responsavel: Responsavel): Promise<void> {
    if (id === responsavel.id) {
      throw new RegraNegocio('Para trocar a sua própria senha use POST /auth/alterar-senha (exige a senha atual).');
    }
    validarForcaSenha(novaSenha);
    const senhaHash = await gerarHashSenha(novaSenha);
    let login = '';
    await prisma.$transaction(async (tx) => {
      const atual = await this.usuarios.buscarPorId(id, tx);
      if (!atual) throw new NaoEncontrado('Usuário');
      login = atual.usuario;
      await this.usuarios.atualizar(id, { senhaHash, trocaSenhaObrigatoria: true }, tx);
      await registrarJournal(tx, {
        operacao: 'ATUALIZAR',
        entidade: 'Usuario',
        entidadeId: id,
        dadosDepois: { campo: 'senha', redefinidaPor: responsavel.usuario },
        usuario: responsavel.usuario
      });
    });
    controleLogin.registrarSucesso(login); // redefinir a senha também libera um login bloqueado por tentativas
  }

  // Exclui a conta mesmo que ela tenha histórico: os registros de auditoria permanecem com o login em texto,
  // e a própria exclusão é gravada no journal com os dados que a conta tinha. Desativar continua disponível
  // para quem só quer bloquear o acesso.
  async excluir(id: string, responsavel: Responsavel): Promise<void> {
    if (id === responsavel.id) throw new RegraNegocio('Você não pode excluir a sua própria conta.');

    await prisma.$transaction(async (tx) => {
      const atual = await this.usuarios.buscarPorId(id, tx);
      if (!atual) throw new NaoEncontrado('Usuário');
      exigirNaoSuperusuario(atual.papel, 'excluir este usuário');

      if (atual.ativo) {
        const ativos = await this.usuarios.bloquearAtivosDoPapel(atual.papel, tx);
        exigirContinuidadeDoPapel(atual.papel, ativos, id, 'excluir este usuário');
      }
      const antes = (await this.usuarios.buscarPublicoPorId(id, tx))!;
      await this.usuarios.excluir(id, tx);
      await registrarJournal(tx, { operacao: 'EXCLUIR', entidade: 'Usuario', entidadeId: id, dadosAntes: antes, usuario: responsavel.usuario });
    });
  }
}

// Alves aprova este código.
