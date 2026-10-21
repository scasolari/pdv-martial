CREATE TABLE `TwoFactorIpAttempt` (
    `ipHash` VARCHAR(64) NOT NULL,
    `failedAttempts` INT NOT NULL DEFAULT 0,
    `windowStartedAt` DATETIME(3) NOT NULL,
    `lockedUntil` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`ipHash`),
    INDEX `TwoFactorIpAttempt_lockedUntil_idx` (`lockedUntil`),
    INDEX `TwoFactorIpAttempt_updatedAt_idx` (`updatedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
