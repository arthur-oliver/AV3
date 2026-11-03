-- CreateTable
CREATE TABLE `usuarios` (
    `id` CHAR(36) NOT NULL,
    `usuario` VARCHAR(60) NOT NULL,
    `nome` VARCHAR(120) NOT NULL DEFAULT '',
    `senhaHash` VARCHAR(100) NOT NULL,
    `papel` ENUM('ADMINISTRADOR', 'OPERADOR_CADASTRO', 'GESTOR_ALMOXARIFADO', 'AUDITOR', 'SUPERUSUARIO') NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `ultimoAcesso` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,
    `versao` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `usuarios_usuario_key`(`usuario`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organizacoes` (
    `id` CHAR(36) NOT NULL,
    `razaoSocial` VARCHAR(200) NOT NULL,
    `cnpj` CHAR(14) NOT NULL,
    `inscricaoEstadual` VARCHAR(30) NOT NULL DEFAULT '',
    `enderecoCompleto` TEXT NOT NULL,
    `telefone` VARCHAR(30) NOT NULL DEFAULT '',
    `email` VARCHAR(150) NOT NULL DEFAULT '',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `dataCadastro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,
    `versao` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `organizacoes_cnpj_key`(`cnpj`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contratos` (
    `id` CHAR(36) NOT NULL,
    `organizacaoId` CHAR(36) NOT NULL,
    `dataAssinatura` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dataVencimento` DATETIME(3) NOT NULL,
    `clausulas` JSON NOT NULL,
    `valorMensal` DECIMAL(12, 2) NOT NULL,
    `renovacaoAutomatica` BOOLEAN NOT NULL DEFAULT false,
    `atualizadoEm` DATETIME(3) NOT NULL,
    `versao` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `contratos_organizacaoId_key`(`organizacaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lotes` (
    `id` CHAR(36) NOT NULL,
    `dataEntrada` DATETIME(3) NOT NULL,
    `organizacaoId` CHAR(36) NOT NULL,
    `notaFiscal` VARCHAR(60) NOT NULL,
    `transportadora` VARCHAR(120) NOT NULL,
    `statusProcessamento` ENUM('RECEBIDO', 'EM_TRIAGEM', 'TRIAGEM_CONCLUIDA', 'ENCAMINHADO', 'FINALIZADO') NOT NULL DEFAULT 'RECEBIDO',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `observacoes` TEXT NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,
    `versao` INTEGER NOT NULL DEFAULT 1,

    INDEX `lotes_organizacaoId_idx`(`organizacaoId`),
    INDEX `lotes_dataEntrada_idx`(`dataEntrada`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipamentos` (
    `id` CHAR(36) NOT NULL,
    `codigoBarrasInterno` VARCHAR(40) NOT NULL,
    `tipo` ENUM('COMPUTADOR_MESA', 'NOTEBOOK', 'MONITOR', 'IMPRESSORA', 'SERVIDOR', 'ROTEADOR', 'CABO_ESTRUTURADO', 'FONTE_ALIMENTACAO') NOT NULL,
    `marca` VARCHAR(80) NOT NULL DEFAULT '',
    `modelo` VARCHAR(80) NOT NULL DEFAULT '',
    `anoFabricacao` INTEGER NOT NULL,
    `estadoFisico` ENUM('NOVO', 'BOM_ESTADO', 'USADO_LEVE', 'USADO_MODERADO', 'DANIFICADO_LEVE', 'DANIFICADO_GRAVE', 'INSERVIVEL') NOT NULL,
    `pesoQuilogramas` DECIMAL(10, 3) NOT NULL,
    `loteId` CHAR(36) NOT NULL,
    `posicaoNoLote` INTEGER NOT NULL,
    `statusRastreamento` ENUM('AGUARDANDO_TRIAGEM', 'EM_TRIAGEM', 'AGUARDANDO_DESMONTE', 'EM_DESMONTE', 'PECAS_REAPROVEITADAS', 'MATERIAL_RECICLAVEL', 'DESCARTE_SEGURO', 'BAIXA_DEFINITIVA') NOT NULL DEFAULT 'AGUARDANDO_TRIAGEM',
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,
    `versao` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `equipamentos_codigoBarrasInterno_key`(`codigoBarrasInterno`),
    INDEX `equipamentos_statusRastreamento_idx`(`statusRastreamento`),
    UNIQUE INDEX `equipamentos_loteId_posicaoNoLote_key`(`loteId`, `posicaoNoLote`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimentacoes` (
    `id` CHAR(36) NOT NULL,
    `equipamentoId` CHAR(36) NOT NULL,
    `dataHora` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `origem` VARCHAR(120) NOT NULL,
    `destino` VARCHAR(120) NOT NULL,
    `responsavel` VARCHAR(60) NOT NULL,
    `observacao` TEXT NOT NULL,

    INDEX `movimentacoes_equipamentoId_dataHora_idx`(`equipamentoId`, `dataHora`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_transacoes` (
    `id` CHAR(36) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `operacao` VARCHAR(40) NOT NULL,
    `entidade` VARCHAR(40) NOT NULL,
    `entidadeId` CHAR(36) NOT NULL,
    `dadosAntes` JSON NULL,
    `dadosDepois` JSON NULL,
    `usuarioResponsavel` VARCHAR(60) NOT NULL,

    INDEX `journal_transacoes_entidade_entidadeId_idx`(`entidade`, `entidadeId`),
    INDEX `journal_transacoes_timestamp_idx`(`timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chaves_api` (
    `id` CHAR(36) NOT NULL,
    `nome` VARCHAR(120) NOT NULL,
    `organizacaoId` CHAR(36) NOT NULL,
    `prefixo` VARCHAR(12) NOT NULL,
    `hashChave` CHAR(64) NOT NULL,
    `permissoes` JSON NOT NULL,
    `limitePorMinuto` INTEGER NOT NULL DEFAULT 60,
    `ativa` BOOLEAN NOT NULL DEFAULT true,
    `expiraEm` DATETIME(3) NULL,
    `ultimoUsoEm` DATETIME(3) NULL,
    `criadoPor` VARCHAR(60) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,
    `versao` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `chaves_api_prefixo_key`(`prefixo`),
    INDEX `chaves_api_organizacaoId_idx`(`organizacaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tarefas_relatorio` (
    `id` CHAR(36) NOT NULL,
    `tipo` ENUM('EFICIENCIA', 'RENTABILIDADE', 'VIDA_UTIL') NOT NULL,
    `formato` ENUM('JSON', 'CSV') NOT NULL DEFAULT 'JSON',
    `status` ENUM('PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'FALHA') NOT NULL DEFAULT 'PENDENTE',
    `tentativas` INTEGER NOT NULL DEFAULT 0,
    `maxTentativas` INTEGER NOT NULL DEFAULT 3,
    `proximaTentativaEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `parametros` JSON NULL,
    `organizacaoId` CHAR(36) NULL,
    `chaveApiId` CHAR(36) NULL,
    `solicitadoPor` VARCHAR(80) NOT NULL,
    `nomeArquivo` VARCHAR(120) NULL,
    `tipoConteudo` VARCHAR(60) NULL,
    `tamanhoBytes` INTEGER NULL,
    `resultado` LONGTEXT NULL,
    `erro` TEXT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `iniciadoEm` DATETIME(3) NULL,
    `concluidoEm` DATETIME(3) NULL,

    INDEX `tarefas_relatorio_status_proximaTentativaEm_idx`(`status`, `proximaTentativaEm`),
    INDEX `tarefas_relatorio_organizacaoId_idx`(`organizacaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analises_resultado` (
    `id` CHAR(36) NOT NULL,
    `tipo` ENUM('EFICIENCIA', 'RENTABILIDADE', 'VIDA_UTIL') NOT NULL,
    `organizacaoId` CHAR(36) NULL,
    `origem` ENUM('AGENDADA', 'MANUAL', 'TAREFA') NOT NULL,
    `solicitadoPor` VARCHAR(80) NOT NULL,
    `periodoInicio` DATETIME(3) NULL,
    `periodoFim` DATETIME(3) NULL,
    `parametros` JSON NULL,
    `resultado` JSON NOT NULL,
    `duracaoMs` INTEGER NOT NULL,
    `geradoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `analises_resultado_tipo_geradoEm_idx`(`tipo`, `geradoEm`),
    INDEX `analises_resultado_organizacaoId_idx`(`organizacaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `contratos` ADD CONSTRAINT `contratos_organizacaoId_fkey` FOREIGN KEY (`organizacaoId`) REFERENCES `organizacoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lotes` ADD CONSTRAINT `lotes_organizacaoId_fkey` FOREIGN KEY (`organizacaoId`) REFERENCES `organizacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `equipamentos` ADD CONSTRAINT `equipamentos_loteId_fkey` FOREIGN KEY (`loteId`) REFERENCES `lotes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacoes` ADD CONSTRAINT `movimentacoes_equipamentoId_fkey` FOREIGN KEY (`equipamentoId`) REFERENCES `equipamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chaves_api` ADD CONSTRAINT `chaves_api_organizacaoId_fkey` FOREIGN KEY (`organizacaoId`) REFERENCES `organizacoes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarefas_relatorio` ADD CONSTRAINT `tarefas_relatorio_chaveApiId_fkey` FOREIGN KEY (`chaveApiId`) REFERENCES `chaves_api`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
