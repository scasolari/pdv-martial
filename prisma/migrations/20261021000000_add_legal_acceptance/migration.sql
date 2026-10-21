ALTER TABLE `Database`
    ADD COLUMN `authorizationConfirmedAt` DATETIME(3) NULL,
    ADD COLUMN `authorizationVersion` VARCHAR(32) NULL;

CREATE TABLE `LegalAcceptance` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(32) NOT NULL,
    `documentVersion` VARCHAR(32) NOT NULL,
    `acceptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE INDEX `LegalAcceptance_userId_documentType_documentVersion_key` (`userId`, `documentType`, `documentVersion`),
    INDEX `LegalAcceptance_userId_acceptedAt_idx` (`userId`, `acceptedAt`),
    CONSTRAINT `LegalAcceptance_userId_fkey`
        FOREIGN KEY (`userId`) REFERENCES `User` (`id`)
        ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
