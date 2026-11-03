# Greencode AV3 — Relatório técnico

Este relatório justifica as decisões de arquitetura da AV3: camada analítica, API pública para parceiros, processamento assíncrono e como o sistema cresceria para centenas ou milhares de parceiros. O detalhe das rotas está em [API.md](./API.md) e as decisões herdadas da AV2, em [ARQUITETURA.md](./ARQUITETURA.md).

## 1. Visão geral da evolução

A AV3 mantém o monólito em camadas da AV2 (rotas → controllers → serviços → repositórios → MySQL) e acrescenta três blocos, cada um em módulos próprios:

```text
                    ┌──────────────────────────────────────────────┐
 operação (JWT) ───▶│ /api/v1/internal   análises, relatórios      │
 administração  ───▶│ /api/v1/admin      contas, chaves, fila      │──▶ serviços ──▶ MySQL
 parceiros (chave) ▶│ /api/v1/public     lotes, rastreio, análises │
                    └──────────────────────────────────────────────┘
                              ▲                          ▲
        agendador (node-cron) ┘                          └ worker da fila (mesmo processo)
```

| Bloco | Código | Tabelas novas |
| --- | --- | --- |
| Camada analítica | `src/analytics`, `AnaliseServico`, `AgendadorAnalises` | `analises_resultado` |
| API pública | `src/rotas/publicas.ts`, `plugins/chaveApi.ts`, `seguranca/chaveApi.ts`, `seguranca/limitePorChave.ts` | `chaves_api` |
| Processamento assíncrono | `src/fila`, `FilaServico`, `regras/retry.ts` | `tarefas_relatorio` |

## 2. Camada analítica

### 2.1 Os três insights

Todos partem de um mesmo conjunto de dados (equipamentos de lotes ativos que entraram no período, com suas movimentações) e são **funções puras** em `src/analytics`: recebem os dados e devolvem o resultado, sem acessar o banco. Isso permite testá-las sem MySQL e reproduzir qualquer número.

**Eficiência operacional** (`eficiencia.ts`). Um equipamento é *concluído* quando chega a um destino final (peças reaproveitadas, material reciclável ou descarte seguro). O destino é lido do histórico de movimentações, e não do status atual, porque depois do destino o equipamento ainda recebe a baixa definitiva e o status deixaria de dizer como ele terminou.

* `taxaConclusao` = concluídos ÷ total;
* `aproveitamento` = (reaproveitados + recicláveis) ÷ concluídos;
* `indiceDeEficiencia` (0 a 100) = média simples entre as duas taxas;
* tempo até a primeira movimentação e tempo de ciclo (entrada do lote → destino final), em horas, com média, mediana, desvio padrão, mínimo e máximo;
* **tempo de triagem por lote**: horas da entrada do lote até o último equipamento sair da triagem (só entram lotes cuja triagem já terminou);
* **operadores**: movimentações registradas por cada responsável e tempo médio de cada etapa que ele encerrou (o tempo de uma etapa é o intervalo desde a movimentação anterior, ou desde a entrada do lote);
* **período do ano**: lotes, equipamentos e tempo médio de triagem por mês de entrada;
* vazão (equipamentos por dia), distribuição por status, detalhamento por tipo e por organização;
* **gargalo**: o status ainda em aberto com mais equipamentos parados e a etapa (destino) que mais demora em média.

**Rentabilidade por tipo de equipamento** (`rentabilidade.ts`).

```text
receita = peso(kg) × valor_base_por_kg(tipo) × fator_do_estado × fator_da_marca
custo   = peso × 1,50 + 2,50 por unidade (+ peso × 3,00 se o destino é descarte seguro)
margem  = receita − custo
```

Os valores de referência ficam em `parametros.ts` e **são devolvidos junto com cada resultado** (campo `parametros`), então quem lê o número sabe com quais premissas ele foi calculado. São estimativas de apoio à decisão, não valores contábeis: o sistema não tem preço de venda real, e o relatório diz isso. O resultado ordena os tipos por margem e indica o mais e o menos rentável. Como o enunciado pede priorizar por estado, marca e modelo, ele traz também os 10 melhores **modelos** e **marcas** pela margem média por equipamento (o estado físico já entra na receita de cada unidade).

**Vida útil restante** (`vidaUtil.ts`). Para cada tipo de equipamento ajusta-se uma regressão linear simples por mínimos quadrados (OLS):

```text
x = idade em anos (ano de referência − ano de fabricação)
y = severidade do desgaste (NOVO = 0 ... INSERVIVEL = 6)
y = inclinação · x + intercepto
```

A *idade limite* é o x em que a reta chega a 6 (inservível); a vida restante de cada equipamento é a idade limite menos a idade atual (nunca menor que zero). O resultado traz inclinação, intercepto, R², um nível de confiança (R² ≥ 0,7 alta, ≥ 0,4 média, abaixo disso baixa) e as 20 menores vidas restantes do tipo. O sistema **recusa projetar** (e explica o motivo) quando há menos de 3 equipamentos, todos com a mesma idade ou quando a reta não mostra desgaste crescente; devolver um número nesses casos seria enganoso.

### 2.2 Biblioteca estatística: simple-statistics

| Opção | Prós | Contras | Decisão |
| --- | --- | --- | --- |
| **simple-statistics** | Pequena, sem dependências, tipada, traz `mean`, `median`, `standardDeviation`, `linearRegression`, `rSquared`; é exatamente o que os três insights usam | Só estatística (não faz álgebra matricial) | **Escolhida** |
| mathjs | Muito completa (matrizes, unidades, expressões) | Pesada para o uso real; a regressão teria de ser montada à mão; mais superfície para manter | Rejeitada |
| Implementação própria | Nenhuma dependência | Reimplementar e testar fórmulas já consagradas é risco sem ganho | Rejeitada |

Uma regressão simples com uma variável explicativa resolve o problema proposto e é explicável em uma frase. Se no futuro houver mais variáveis (marca, uso, ambiente), a troca para regressão múltipla ou para mathjs fica isolada em `calculos.ts`, o único arquivo que importa a biblioteca.

### 2.3 Modelagem da tabela de resultados

`analises_resultado` guarda **uma linha por execução**: `tipo`, `organizacaoId` (nulo = todas), `origem` (agendada, manual ou tarefa), `solicitadoPor`, período, `parametros`, `resultado` (JSON), `duracaoMs` e `geradoEm`, com índices em `(tipo, geradoEm)` e `organizacaoId`.

* **Nunca se sobrescreve.** O histórico permite comparar uma previsão antiga com o que aconteceu depois e acompanhar a tendência dos indicadores. A "última análise" é só `ORDER BY geradoEm DESC LIMIT 1`.
* **Resultado em JSON em vez de colunas.** Os três insights têm formatos diferentes e vão evoluir; uma tabela por insight, com dezenas de colunas, exigiria migração a cada ajuste. O que é filtrado (tipo, escopo, data) fica em colunas indexadas; o corpo, que só é lido inteiro, fica em JSON.
* **Escopo por organização.** A mesma estrutura serve para a visão global (operação interna) e para a visão de cada parceiro (API pública), sem duplicar tabelas.
* **Custo da escolha:** não dá para consultar um indicador específico com SQL simples (por exemplo "todas as taxas de conclusão abaixo de 50%"). Se esse uso surgir, extrai-se o indicador para uma coluna ou tabela própria, mantendo o JSON completo.

### 2.4 Execução: endpoints e agendamento

* **Sob demanda:** `POST /api/v1/internal/analises/{tipo}/executar` calcula, grava e devolve.
* **Consulta:** `GET .../analises/{tipo}/ultima` e `GET .../analises/historico`.
* **Agendada:** `AgendadorAnalises` usa **node-cron** (padrão `0 3 * * *`, fuso de São Paulo, configurável) e roda os três tipos para o escopo global e para cada organização ativa. Uma falha isolada é registrada e não interrompe as demais; uma trava impede duas execuções simultâneas no mesmo processo. `POST /api/v1/admin/analises/executar-agendadas` dispara o mesmo trabalho na hora.

**Por que node-cron dentro do processo?** É simples, não exige infraestrutura extra e funciona igual no Windows e no Ubuntu (cron do sistema e systemd timers não são portáveis entre os dois). A limitação é que, com **várias instâncias**, todas dispararão o agendamento. A saída está descrita na seção 6.

## 3. API pública para parceiros

### 3.1 Chaves de API

* Formato `gck_<12 hex>_<40 hex>`, gerado com `crypto.randomBytes` (160 bits de segredo).
* O banco guarda só o **prefixo** (índice único, para localizar a chave) e o **hash SHA-256** da chave inteira. A chave completa aparece uma única vez, na criação ou rotação. Para um segredo aleatório e longo um hash rápido é suficiente (bcrypt é para senhas escolhidas por pessoas) e mantém a verificação barata em cada requisição.
* Comparação em tempo constante (`timingSafeEqual`).
* Cada chave pertence a **uma organização** e só enxerga os dados dela; recurso de outra organização responde 404, como se não existisse (não revela que existe).
* Ciclo de vida: criar, listar, alterar permissões/limite/validade, **revogar** (efeito imediato), reativar e **rotacionar** (segredo novo, o antigo deixa de valer). Tudo passa por versionamento otimista e vai para o journal.

### 3.2 Permissões

Cada chave recebe uma lista de permissões e cada rota exige a sua:

| Permissão | Libera |
| --- | --- |
| `LER_RASTREABILIDADE` | Listar/detalhar lotes e rastrear equipamentos |
| `ESCREVER_LOTES` | Registrar lotes (sempre na organização da chave) |
| `LER_RELATORIOS` | Análises e relatórios assíncronos |

Chave sem a permissão recebe 403 `SEM_PERMISSAO`, dizendo qual faltou.

### 3.3 Rate limiting por chave

Cada chave tem o seu `limitePorMinuto` (padrão 60). O limitador (`LimitadorPorChave`) usa **janela fixa de 1 minuto em memória** e as respostas trazem `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset`; ao exceder, 429 `LIMITE_DA_CHAVE` com `Retry-After`. Esse limite convive com o limite geral por IP da AV2 (que protege o login e o restante da API).

* **Por que janela fixa:** é a mais simples de entender e de explicar a um parceiro. Seu defeito conhecido é permitir uma rajada na virada da janela (até 2× o limite em instantes). Para um limite de proteção, e não de cobrança, é aceitável; para cobrança por uso seria preciso janela deslizante ou *token bucket*.
* **Ordem das verificações** (no hook `onRequest`, antes de ler o corpo): formato da chave → existência → hash → ativa → validade → limite → permissão. Assim requisições sem credencial são recusadas barato.

### 3.4 Separação de rotas, versionamento e deprecação

| Prefixo | Público | Autenticação |
| --- | --- | --- |
| `/api/v1/internal` | Operação da própria empresa | JWT + papéis |
| `/api/v1/admin` | Administração (contas, chaves, fila) | JWT + superusuário/administrador |
| `/api/v1/public` | Parceiros externos | `X-API-Key` + permissões |

* A versão está **na URL** (`/v1`), explícita e visível em logs e no Swagger; toda resposta de `/api/v1` traz `X-API-Version`.
* As rotas da AV2 (sem prefixo) **continuam funcionando, mas estão deprecadas**: respondem com `Deprecation: true`, `Sunset` (data de remoção) e `Link: </api/v1/internal>; rel="successor-version"`, e ficam fora do Swagger. Assim quem já usa a AV2 tem prazo para migrar. Uma versão futura incompatível nasce como `/api/v2`, convivendo com a v1 até o `Sunset`.
* **Alternativa rejeitada:** versão em cabeçalho ou *content negotiation* (mais "puro" em REST, mas difícil de testar no navegador e de documentar no Swagger).

### 3.5 Documentação

O Swagger (`/docs`) traz tags por área, os dois esquemas de segurança (`bearerAuth` e `apiKey`), exemplos de corpo nas rotas de escrita e, em cada rota pública, os códigos de erro possíveis com exemplo (`401 CHAVE_API_INVALIDA`, `403 SEM_PERMISSAO`, `404`, `409`, `422`, `429 LIMITE_DA_CHAVE`). Todo erro da API tem o mesmo formato `{ "erro": "CODIGO", "mensagem": "texto" }`.

## 4. Processamento assíncrono

### 4.1 Fluxo

```text
POST /relatorios ──▶ grava tarefa PENDENTE ──▶ responde 202 + id + links
                              │
              worker (a cada 2 s) reivindica ──▶ PROCESSANDO ──▶ calcula + gera arquivo
                              │                                      │
                    falha ◀───┘                                      └──▶ CONCLUIDA
        (retry com espera crescente ou FALHA)

GET /relatorios/{id}            → status (PENDENTE | PROCESSANDO | CONCLUIDA | FALHA)
GET /relatorios/{id}/download   → arquivo JSON ou CSV (409 se ainda não estiver pronto)
```

### 4.2 Fila no MySQL

| Opção | Prós | Contras | Decisão |
| --- | --- | --- | --- |
| **Tabela no MySQL** | Zero infraestrutura nova; a tarefa é gravada no mesmo banco (consistência, consulta e auditoria por SQL); funciona igual em Windows e Ubuntu | Polling; throughput menor que um broker dedicado; o banco carrega mais uma carga | **Escolhida** |
| Redis + BullMQ | Retry, atraso e prioridade prontos; alto throughput | Mais um serviço para instalar e operar (em Windows é desconfortável) | Rejeitada para esta entrega |
| RabbitMQ | Roteamento sofisticado, entrega garantida | Muito além do necessário; operação pesada | Rejeitada |

A necessidade real é: poucas tarefas pesadas, rastreáveis e com status consultável. Uma tabela atende, e o próprio status que o parceiro consulta **é** a fila.

### 4.3 Reivindicação atômica

O worker procura a tarefa `PENDENTE` com `proximaTentativaEm` vencida e a "reivindica" com um único `UPDATE ... WHERE id = ? AND status = 'PENDENTE'`. Só uma execução obtém `count = 1`; as demais perdem a disputa e procuram a próxima. Com isso é seguro ter **mais de um worker** (ou mais de uma instância) sem processar a mesma tarefa duas vezes. Há teste de integração com três disputas simultâneas pela mesma tarefa.

### 4.4 Política de retry

| Situação | Tratamento |
| --- | --- |
| Erro de infraestrutura (banco indisponível, timeout) | Volta a `PENDENTE` com espera **exponencial**: 5 s, 10 s, 20 s... (base × 2^(tentativa−1), teto de 1 h), até **3 tentativas** |
| Erro de negócio (ex.: organização não existe mais) | **Falha na hora**: repetir daria o mesmo erro e só gastaria recursos |
| Tentativas esgotadas | Status `FALHA`, com a mensagem de erro; o administrador pode **reenfileirar** (zera as tentativas) |
| Worker caiu no meio (tarefa "PROCESSANDO" há mais de 5 min) | Rotina de recuperação devolve à fila (ou falha, se as tentativas acabaram) |

A espera crescente evita martelar um banco que já está com problema. Os parâmetros (tentativas, base, prazo de tarefa travada) são variáveis de ambiente. A regra de decisão é função pura (`regras/retry.ts`) e o worker é testado com uma fila falsa, sem banco.

**Idempotência:** o processamento de um relatório só grava uma linha nova em `analises_resultado` e o conteúdo na própria tarefa. Repetir após falha parcial gera, no pior caso, uma análise a mais no histórico, sem corromper dados.

### 4.5 Download

O arquivo é gerado pelo worker e guardado na própria tarefa (`LONGTEXT`), em JSON ou CSV (mesmo padrão do Excel pt-BR da AV2: `;`, BOM, CRLF e proteção contra injeção de fórmula). Guardar no banco evita depender de disco compartilhado entre instâncias; para arquivos grandes, a evolução é gravá-los em armazenamento de objetos e guardar só o endereço.

## 5. Compatibilidade

Node.js 20+, sem dependência nativa nova (`simple-statistics` e `node-cron` são JavaScript puro). O agendador usa o fuso por nome (`America/Sao_Paulo`), igual nos dois sistemas. Nenhum comando de script depende de shell específico. Alvo: Windows 10+ e Ubuntu 24.04.03+ e derivados.

## 6. Escalando para centenas ou milhares de parceiros

Os gargalos aparecem em ordem previsível; cada item abaixo diz o que já está pronto e o que seria feito.

| Ponto | Hoje | Para centenas/milhares de parceiros |
| --- | --- | --- |
| **Autenticação da chave** | 1 consulta indexada por prefixo em cada requisição | Cache em memória (TTL de 30–60 s) das chaves ativas; invalidar na revogação |
| **Rate limit** | Contador em memória, por processo | Com várias instâncias o limite efetivo seria N× maior: mover os contadores para **Redis** (`INCR` + `EXPIRE`) ou balancear por sticky session. A interface `consumir(chave, limite)` já isola essa troca |
| **Agendamento** | `node-cron` em cada instância | Eleger uma instância (lock no banco ou `GET_LOCK` do MySQL) ou separar um processo "agendador"; já existe o endpoint que dispara o mesmo trabalho |
| **Análises por parceiro** | Laço sequencial: 3 análises × organizações | Enfileirar **uma tarefa por parceiro** na mesma fila (já suportada) e deixar vários workers consumirem em paralelo |
| **Leitura dos dados** | Carrega os equipamentos do período na memória | Pré-agregar no SQL (`GROUP BY tipo/status`) ou numa tabela de agregados diária; só a regressão precisa de pontos individuais |
| **Fila** | Polling a cada 2 s, 1 tarefa por vez por worker | Várias instâncias de worker (a reivindicação atômica já permite); no MySQL 8 usar `SELECT ... FOR UPDATE SKIP LOCKED` para evitar disputa; acima de milhares de tarefas por minuto, migrar para Redis/BullMQ |
| **Tamanho das tabelas** | `analises_resultado` e `tarefas_relatorio` só crescem | Política de retenção (apagar/arquivar tarefas concluídas após N dias; manter o histórico analítico resumido), particionamento por data |
| **Banco** | Uma instância | Réplica de leitura para a camada analítica e a API pública (que são só leitura), preservando o primário para escrita |
| **Isolamento de carga** | Worker no mesmo processo da API | Rodar o worker como processo separado (mesmo código, outro comando) para que relatórios pesados não disputem CPU com a API |
| **Operação** | Logs do Fastify | Métricas por chave (requisições, 429, latência) e alertas; o campo `ultimoUsoEm` já permite identificar chaves ociosas |

Em resumo: o desenho em camadas e as interfaces pequenas (limitador, fila, processador) fazem com que cada gargalo seja resolvido trocando **uma peça**, sem reescrever o restante. A decisão de começar simples (memória + MySQL) é consciente: entrega o comportamento correto agora, e este quadro mostra o caminho de crescimento.

## 7. Limitações assumidas

* Os parâmetros de rentabilidade são estimativas de referência, não preços de mercado; podem ser ajustados em `parametros.ts`.
* A regressão usa uma única variável (idade); a confiança informada (R²) deve ser lida junto com o resultado.
* Limite por chave em memória e agendamento por instância (seção 6).
* Sem HTTPS embutido (usar proxy reverso), sem refresh token e sem criptografia em repouso, como na AV2.

## 8. Testes

* **Unitários (sem banco):** cálculos estatísticos e as três análises com dados controlados, exportação CSV, geração/validação de chaves, limitador, política de retry e worker com fila falsa.
* **Integração (API + MySQL):** gestão de chaves, autenticação por chave (ausente, inválida, revogada, expirada, rotacionada), permissões, isolamento entre organizações, limite por chave, versionamento e deprecação, Swagger, as três análises, histórico, agendador, fila completa (202 → status → download), retry com espera crescente, falha imediata em erro de negócio, tarefa travada, reenfileiramento e reivindicação atômica.
