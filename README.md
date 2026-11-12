<img src="docs/assets/logo_greencode.png" alt="Banner do projeto" style="width:100%;">

# Greencode — AV3

API REST em Node.js e TypeScript para apoiar a **logística reversa de resíduos eletrônicos**: do recebimento do lote até a triagem, o desmonte e a baixa definitiva de cada equipamento, com rastreabilidade e auditoria. A AV3 evolui a API da AV2 com uma **camada analítica**, uma **API pública para parceiros** e **processamento assíncrono de relatórios**.

> **Quer executar o projeto do zero?** Siga o [passo a passo](./docs/PASSO-A-PASSO.txt). Este README apresenta o sistema; a execução é explicada somente lá.

## O que há de novo na AV3

| Área | Funcionalidades |
| --- | --- |
| Camada analítica | Três análises persistidas em tabela, com histórico: **eficiência operacional** (taxas, tempos de ciclo, gargalo), **rentabilidade por tipo de equipamento** (receita, custo e margem) e **vida útil restante** por regressão linear (OLS) |
| Execução das análises | Sob demanda por endpoint e **agendada** (node-cron), para o escopo global e para cada organização |
| Portal web | Interface em React + Tailwind, no navegador, servida pelo próprio servidor (`/app/`): o parceiro entra com a chave de API e consulta lotes, rastreia equipamentos, registra lotes, vê análises e baixa relatórios; a equipe interna entra com usuário e senha e vê, conforme o papel, usuários (só o superusuário), organizações e contratos, lotes, equipamentos, relatórios, auditoria, análises, chaves e fila |
| API pública | Rotas para parceiros com **chave de API** (`X-API-Key`), permissões por chave, **limite de requisições por chave**, isolamento entre organizações e documentação Swagger com exemplos e códigos de erro |
| Processamento assíncrono | Relatórios em **fila no MySQL**: o pedido devolve um id (202), o status é consultado em outro endpoint e o arquivo (JSON ou CSV) é baixado ao final, com **retry** de espera crescente |
| Organização e versionamento | Rotas separadas em `/api/v1/internal`, `/api/v1/admin` e `/api/v1/public`; cabeçalho `X-API-Version`; rotas antigas da AV2 mantidas como **deprecadas** (`Deprecation`, `Sunset`, `Link`) |

As decisões e justificativas estão no [relatório técnico](./docs/RELATORIO-TECNICO.md).

## O que o sistema já fazia (AV2)

| Área | Funcionalidades |
| --- | --- |
| Organizações e contratos | Cadastro com validação de CNPJ (sem duplicidade), contrato com vigência, cláusulas e valor mensal, correção e exclusão controladas |
| Lotes | Recebimento com nota fiscal e transportadora, data de entrada validada, triagem e finalização |
| Equipamentos | Tipo, marca, modelo, ano e peso, código de barras igual ao id, estado físico e status de rastreamento |
| Rastreabilidade | Cada mudança de status ou de estado físico vira uma movimentação, com responsável e justificativa |
| Relatórios e auditoria | Resumos por organização, por status e financeiro, com exportação em CSV; consulta ao journal |
| Contas e acesso | Login com JWT, cinco papéis e gestão de contas por um superusuário único |

## Papéis (acesso interno)

| Papel | Responsabilidade |
| --- | --- |
| `SUPERUSUARIO` | Único; maior nível de acesso, gerencia as contas e executa qualquer função |
| `ADMINISTRADOR` | Acesso total à operação (inclui chaves de API e fila), sem gerir contas |
| `OPERADOR_CADASTRO` | Organizações e contratos |
| `GESTOR_ALMOXARIFADO` | Lotes, triagem, equipamentos e movimentações |
| `AUDITOR` | Consulta, relatórios, auditoria e análises |

Parceiros externos não usam papéis: cada **chave de API** pertence a uma organização e recebe permissões próprias (`LER_RASTREABILIDADE`, `ESCREVER_LOTES`, `LER_RELATORIOS`).

## Garantias de integridade e segurança

* **Sem atualizações perdidas:** versionamento otimista (`versao`); versão antiga responde 409.
* **Tudo ou nada:** cada operação roda em transação junto com o registro de auditoria.
* **Soft delete e exclusão em cadeia**, status do lote derivado dos equipamentos, listagens paginadas.
* **Chaves de API seguras:** só o hash SHA-256 fica no banco; a chave aparece uma única vez; revogação e rotação imediatas.
* **Isolamento:** um parceiro nunca enxerga dados de outra organização.
* **Proteção da API:** helmet, CORS por lista de origens, limite por IP, limite por chave e bloqueio de login por tentativas.
* **Fila resiliente:** reivindicação atômica (vários workers sem duplicidade), retry com espera exponencial, recuperação de tarefas travadas.

## Tecnologias

Node.js 20+, TypeScript, Fastify 5, Prisma 6, MySQL 8, JWT, bcryptjs, **simple-statistics**, **node-cron**, Swagger (OpenAPI) e Vitest.

## Arquitetura

Monólito em camadas, com a regra de negócio separada da interface HTTP e do banco:

```text
Rotas (schema + papel/chave) → Controllers → Serviços (regras + transação) → Repositórios (Prisma) → MySQL
                                                  ▲
                          agendador (cron) e worker da fila usam os mesmos serviços
```

## Estrutura do repositório

```text
AV3/
├── README.md                 # este arquivo
├── docs/                     # documentação, passo a passo e enunciado
└── greencode-av3/            # código da API
    ├── src/
    │   ├── analytics/        # cálculos puros: eficiência, rentabilidade, vida útil, agendador
    │   ├── fila/             # worker e processador de relatórios
    │   ├── rotas/            # internal, admin e public (versão 1)
    │   └── ...               # controllers, serviços, repositórios, regras, segurança
    ├── web/                  # portal compilado (gerado por "npm run build:web"; não vai para o Git)
    ├── frontend/             # código do portal: React + Tailwind CSS (Vite)
    ├── prisma/               # modelo do banco, migrações e dados de exemplo
    └── tests/                # testes unitários e de integração
```

## Endereços do sistema

Com o projeto rodando (npm run dev:tudo), estes são os endereços:

| Endereço | O que é |
|---|---|
| http://127.0.0.1:3000/app/ | **Portal web** compilado, entregue pelo servidor da API. |
| http://localhost:5173/app/ | **Portal em desenvolvimento** (Vite), com recarga automática ao editar `frontend/`. Só existe com `npm run dev:tudo` ou `npm run dev:web`. |
| http://127.0.0.1:3000/docs | **Swagger**: documentação interativa da API. |
| http://127.0.0.1:3000/health | **Saúde da API**: responde se o servidor está no ar. |

### Rodar tudo com um comando

Dentro de `greencode-av3`, depois do `npm install` e do `npm run setup`:

```
npm run dev:tudo
```

Esse comando compila o portal (`build:web`), sobe a API (`dev`) e o portal em desenvolvimento (`dev:web`), nos endereços acima. `Ctrl+C` encerra os dois. Os comandos separados continuam disponíveis: `npm run build:web`, `npm run dev` e `npm run dev:web`.

### Acessos para entrar no portal

**Equipe interna** (aba "Equipe interna" da tela de entrada): o `npm run setup` cria estes usuários. O padrão da senha é o nome do papel com inicial maiúscula, seguido de `@123`.

| Usuário | Senha | Papel |
|---|---|---|
| `superusuario` | `Super@123` | Superusuário: acesso total e único que gerencia as contas |
| `admin` | `Admin@123` | Administrador |
| `operador` | `Operador@123` | Operador de cadastro |
| `gestor` | `Gestor@123` | Gestor de almoxarifado |
| `auditor` | `Auditor@123` | Auditor |

Essas contas de demonstração entram sem troca de senha. Usuários novos, criados pelo superusuário no portal, precisam trocar a senha provisória no primeiro acesso.

**Empresa parceira** (aba "Sou parceiro"): o parceiro entra com uma chave de API. A chave pode ser gerada de duas formas: no portal, pelo **superusuário** ou por um **administrador**, ou no terminal, pelo script de demonstração.

**Pelo portal (superusuário ou administrador):** entre na aba "Equipe interna" como `superusuario` (ou `admin`), abra **Chaves de API**, dê um nome à chave, escolha a organização parceira, marque as permissões, ajuste o limite de requisições por minuto e clique em **Criar chave**. A chave aparece uma única vez na tela: copie e entregue ao parceiro. Na mesma tela dá para revogar, reativar ou trocar a chave. Assim é possível gerar chave para qualquer uma das organizações cadastradas.

**Pelo terminal:** rode um dos comandos abaixo, dentro de `greencode-av3`. As duas primeiras opções criam a chave para a organização de demonstração (Banco Horizonte), com limite de 60 requisições por minuto. A diferença está só nas permissões.

**Chave só de consulta** (permissões `LER_RASTREABILIDADE` e `LER_RELATORIOS`): o parceiro vê Início, Lotes, Rastrear equipamento, Análises e Pedidos de relatório, sem poder alterar nada.

```
npm run chave:demo
```

**Chave com registro de lotes** (as permissões acima mais `ESCREVER_LOTES`): além de tudo o que a chave de consulta permite, aparece a opção **Registrar lote**, para enviar um lote novo com os equipamentos. O `--` faz o npm repassar a opção `--escrita` ao script.

```
npm run chave:demo -- --escrita
```

**Chave da segunda empresa parceira** (Varejo Nova Era Comércio Ltda): sem a opção `--org`, a chave é sempre do Banco Horizonte. Com `--org=varejo`, ela é da Varejo Nova Era, que tem os próprios lotes e equipamentos, e o portal mostra só os dados dela. Dá para combinar com `--escrita`.

```
npm run chave:demo -- --org=varejo
```

```
npm run chave:demo -- --org=varejo --escrita
```

A opção `--org` também aceita `hospital` e `universidade`.

O terminal mostra a chave (começa com `gck_`) uma única vez: copie e cole no portal. Cada execução cria uma chave nova, e as anteriores continuam valendo.

### Dados de exemplo

O `npm run setup` (ou só `npm run db:seed`) carrega uma massa de dados para todas as telas terem o que mostrar. Pode rodar mais de uma vez: o seed só acrescenta o que ainda não existe.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Passo a passo](./docs/PASSO-A-PASSO.txt) | Como baixar, configurar, testar e executar |
| [Relatório técnico](./docs/RELATORIO-TECNICO.md) | Decisões da AV3: estatística, tabelas, fila, retry, API pública e escala |
| [Documentação técnica](./docs/docs.md) | Arquitetura, segurança, validações, persistência, papéis, falhas e testes |
| [Arquitetura e decisões](./docs/ARQUITETURA.md) | Justificativas, trade-offs e limites do monólito |
| [Referência da API](./docs/API.md) | Todas as rotas, permissões e códigos de erro |
| [Checklist dos requisitos](./docs/CHECKLIST.md) | Requisitos da AV3 e onde cada um foi atendido |
| [Enunciado](./docs/AV3.pdf) | Atividade proposta |