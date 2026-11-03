<img src="docs/assets/logo_greencode.png" alt="Banner do projeto" style="width:100%;">

# Greencode — AV3

API REST em Node.js e TypeScript para apoiar a **logística reversa de resíduos eletrônicos**: do recebimento do lote até a triagem, o desmonte e a baixa definitiva de cada equipamento, com rastreabilidade e auditoria. A AV3 evolui a API da AV2 com uma **camada analítica**, uma **API pública para parceiros** e **processamento assíncrono de relatórios**.

> **Quer executar o projeto do zero?** Siga o [passo a passo](./docs/PASSO-A-PASSO.txt). Este README apresenta o sistema; a execução é explicada somente lá.

## O que há de novo na AV3

| Área | Funcionalidades |
| --- | --- |
| Camada analítica | Três análises persistidas em tabela, com histórico: **eficiência operacional** (taxas, tempos de ciclo, gargalo), **rentabilidade por tipo de equipamento** (receita, custo e margem) e **vida útil restante** por regressão linear (OLS) |
| Execução das análises | Sob demanda por endpoint e **agendada** (node-cron), para o escopo global e para cada organização |
| Portal web | Interface no navegador servida pelo próprio servidor (`/app/`): o parceiro entra com a chave de API e consulta lotes, rastreia equipamentos, registra lotes, vê análises e baixa relatórios; a equipe interna entra com usuário e senha e gerencia análises, chaves e fila |
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
    ├── web/                  # portal web (HTML, CSS e JS, sem etapa de build)
    ├── prisma/               # modelo do banco, migrações e dados de exemplo
    └── tests/                # testes unitários e de integração
```

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
