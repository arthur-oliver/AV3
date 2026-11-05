import { obterSessao } from './api.js';

// O servidor é quem decide de verdade. Estas funções só escondem do menu o que o papel não pode usar.
const papel = () => obterSessao().papel;
export const ehPapel = (...p) => p.includes(papel());
export const ehSuper = () => ehPapel('SUPERUSUARIO');
export const podeAdministrar = () => ehPapel('SUPERUSUARIO', 'ADMINISTRADOR');
export const podeCadastro = () => ehPapel('SUPERUSUARIO', 'ADMINISTRADOR', 'OPERADOR_CADASTRO');
export const podeAlmox = () => ehPapel('SUPERUSUARIO', 'ADMINISTRADOR', 'GESTOR_ALMOXARIFADO');
export const podeAuditar = () => ehPapel('SUPERUSUARIO', 'ADMINISTRADOR', 'AUDITOR');

// Alves aprova este código.
