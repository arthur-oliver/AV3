// Endereço do banco usado pelos testes automatizados. Nunca é o banco do portal (DATABASE_URL):
// por padrão é o mesmo servidor com o nome do banco + "_teste" (ex.: greencode_av3 -> greencode_av3_teste).
// Para usar outro endereço, defina DATABASE_URL_TEST no .env.
import 'dotenv/config';

// Os dois endereços são calculados uma única vez (ao carregar o vitest.config.ts) e guardados em variáveis
// próprias, porque o Vitest troca DATABASE_URL pelo banco de teste antes de rodar os testes.
export function urlBancoPrincipal(): string {
  if (!process.env.GREENCODE_URL_PORTAL) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL ausente. Copie .env.example para .env e preencha os valores.');
    process.env.GREENCODE_URL_PORTAL = url;
  }
  return process.env.GREENCODE_URL_PORTAL;
}

export function urlBancoTeste(): string {
  if (process.env.GREENCODE_URL_TESTE) return process.env.GREENCODE_URL_TESTE;
  const principal = urlBancoPrincipal();
  const url = new URL(process.env.DATABASE_URL_TEST || principal);
  if (!process.env.DATABASE_URL_TEST) url.pathname = `${url.pathname.replace(/\/$/, '')}_teste`;
  const nome = nomeBanco(url.toString());
  if (url.toString() === new URL(principal).toString() || !/test/i.test(nome)) {
    throw new Error(`O banco de teste precisa ser diferente do banco do portal e ter "test" no nome (recebido: "${nome}").`);
  }
  process.env.GREENCODE_URL_TESTE = url.toString();
  return process.env.GREENCODE_URL_TESTE;
}

export const nomeBanco = (url: string) => decodeURIComponent(new URL(url).pathname.slice(1));
