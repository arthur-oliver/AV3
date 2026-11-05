// Sobe tudo com um comando só: compila o portal (build:web), inicia a API (dev) e o portal em modo
// de desenvolvimento (dev:web). Funciona no Windows e no Linux. Ctrl+C encerra os dois processos.
// Arthur Oliver Rossi Alves, autor do Greencode.
const { spawn, spawnSync } = require('node:child_process');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const opcoes = { stdio: 'inherit', shell: process.platform === 'win32' };

console.log('\n[1/3] Compilando o portal (npm run build:web)...\n');
const build = spawnSync(npm, ['run', 'build:web'], opcoes);
if (build.status !== 0) {
  console.error('\nO build do portal falhou. Corrija o erro acima e rode de novo.');
  process.exit(build.status || 1);
}

console.log('\n[2/3] Iniciando a API (npm run dev)...');
console.log('[3/3] Iniciando o portal em desenvolvimento (npm run dev:web)...\n');
console.log('  API e portal compilado : http://127.0.0.1:3000/app/');
console.log('  Portal (desenvolvimento): http://localhost:5173/app/');
console.log('  Swagger                : http://127.0.0.1:3000/docs');
console.log('  Saúde da API           : http://127.0.0.1:3000/health\n');

const filhos = [spawn(npm, ['run', 'dev'], opcoes), spawn(npm, ['run', 'dev:web'], opcoes)];

let encerrando = false;
function encerrar(codigo) {
  if (encerrando) return;
  encerrando = true;
  for (const f of filhos) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(f.pid), '/T', '/F'], { stdio: 'ignore' });
    else f.kill('SIGTERM');
  }
  process.exit(codigo);
}
process.on('SIGINT', () => encerrar(0));
process.on('SIGTERM', () => encerrar(0));
// Se um dos dois cair, derruba o outro para não deixar processo solto.
for (const f of filhos) f.on('exit', (c) => encerrar(c || 0));
