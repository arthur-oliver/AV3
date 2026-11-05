# Checklist da AV3 — requisito × implementação

Baseado no enunciado da AV3. A AV2 serviu de base, e seus requisitos continuam atendidos (veja o checklist no repositório da AV2).

| # | Requisito do enunciado | Onde está | Situação |
|---|---|---|---|
| 1 | Camada analítica com ao menos 3 categorias de insight | `src/analytics/eficiencia.ts`, `rentabilidade.ts`, `vidaUtil.ts` | ✅ |
| 2 | Eficiência operacional: tempo médio do lote da entrada ao fim da triagem, gargalos, variação entre operadores e períodos | `eficiencia.ts` (`triagemDosLotes`, `porEtapa`, `porOperador`, `porPeriodo`, gargalo, índice) | ✅ |
| 3 | Rentabilidade por tipo, com base em estado físico, marca e modelo | `rentabilidade.ts` + `parametros.ts` (`porTipo`, `porMarca`, `porModelo`) | ✅ |
| 4 | Previsão de vida útil restante por regressão linear (OLS) | `vidaUtil.ts` + `calculos.ts` (`simple-statistics`) | ✅ |
| 5 | Resultados persistidos em novas tabelas, com histórico | `AnaliseResultado` (`analises_resultado`), uma linha por execução | ✅ |
| 6 | Resultados expostos por endpoints | `/api/v1/internal/analises/...` e `/api/v1/public/analises/{tipo}` | ✅ |
| 7 | Execução por tarefas agendadas em segundo plano (node-cron) | `src/analytics/agendador.ts`, iniciado em `src/server.ts` | ✅ |
| 8 | Biblioteca estatística justificada (simple-statistics ou mathjs) | `docs/RELATORIO-TECNICO.md` (2.2) | ✅ |
| 9 | API pública documentada | Swagger em `/docs` (tags "Público - ...", exemplos, erros) e `docs/API.md` | ✅ |
| 10 | Autenticação por chave de API por parceiro | `plugins/chaveApi.ts`, `seguranca/chaveApi.ts`, `ChaveApiServico` | ✅ |
| 11 | Chaves com permissões específicas | `PermissaoApi`; `app.exigirChave(...)` em cada rota pública | ✅ |
| 12 | Rate limiting | Por chave: `seguranca/limitePorChave.ts`; por IP: `@fastify/rate-limit` | ✅ |
| 13 | Swagger/OpenAPI com exemplos e códigos de erro | `rotas/publicas.ts`, `rotas/comum.ts` (`respostasDeErro`) | ✅ |
| 14 | Rotas públicas e internas/administrativas separadas | `/api/v1/public`, `/api/v1/internal`, `/api/v1/admin` (`rotas/versoes.ts`) | ✅ |
| 15 | Versionamento explícito e política de deprecação | Versão na URL, `X-API-Version`; rotas AV2 com `Deprecation`/`Sunset`/`Link` | ✅ |
| 16 | Processamento assíncrono com fila | `TarefaRelatorio`, `FilaServico`, `TarefaWorker` (fila no MySQL) | ✅ |
| 17 | Id da tarefa → consulta de status → download (CSV/JSON) | `POST/GET /relatorios`, `/relatorios/{id}`, `/relatorios/{id}/download` | ✅ |
| 18 | Política de retry | `regras/retry.ts` (espera exponencial, 3 tentativas, erro de negócio não repete) | ✅ |
| 19 | Relatório técnico: estatística, modelagem das tabelas, retry, escala para centenas/milhares de parceiros | `docs/RELATORIO-TECNICO.md` (seções 2, 4 e 6) | ✅ |
| 20 | Compatível com Windows 10+ e Ubuntu 24.04.03+ e derivados | Sem dependências nativas novas; fuso por nome; instruções para os dois | ⚠️ valide rodando nos dois, se possível |
| 21 | Testes | `tests/unit` (sem banco) e `tests/integration` (API + MySQL; `web.test.ts` cobre o portal) | ✅ |
| 22 | *(extra)* Isolamento por organização na API pública (404 em recurso alheio) | `PublicoController` | ✅ |
| 23 | Interface web para o usuário externo executar os procedimentos (chave, lotes, rastreio, análises, relatórios assíncronos) | `greencode-av3/frontend/` (React + Tailwind; build em `web/`) servido por `rotas/web.ts` em `/app/`; as telas internas seguem a matriz de papéis da AV2 (gestão de usuários só do superusuário) | ✅ |
| 24 | *(extra)* Revogação, rotação e expiração de chaves; chaves auditadas no journal | `ChaveApiServico` | ✅ |
| 25 | *(extra)* Reivindicação atômica, recuperação de tarefas travadas e reenfileiramento | `TarefaRepositorio`, `FilaServico` | ✅ |
| 26 | *(extra)* Massa de dados para as análises e chave de demonstração | `prisma/seed.ts`, `npm run chave:demo` | ✅ |
| 27 | *(extra)* Troca de senha obrigatória no primeiro acesso (senha provisória, bloqueio das demais rotas, nova senha diferente da atual) | `AuthServico`, `plugins/auth.ts`, tela `TrocaSenha` | ✅ |
| 28 | *(extra)* Portal em React + Tailwind (código em `frontend/`, build em `web/`) | `frontend/`, `src/rotas/web.ts` | ✅ |

## Antes de entregar

- [ ] Rodar `npm run setup` e `npm test` do zero e conferir que passa (unitários + integração).
- [ ] Subir a pasta `prisma/migrations/` junto (é o histórico do banco).
- [ ] Conferir que o `.env` **não** foi para o GitHub (só o `.env.example`).
- [ ] Copiar o enunciado para `docs/AV3.pdf` e a logo para `docs/assets/`.
