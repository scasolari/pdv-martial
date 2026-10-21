ALTER TABLE `User`
    ADD COLUMN `twoFAPendingSecret` LONGTEXT NULL,
    ADD COLUMN `twoFAPendingExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `twoFAFailedAttempts` INT NOT NULL DEFAULT 0,
    ADD COLUMN `twoFALockedUntil` DATETIME(3) NULL,
    ADD COLUMN `twoFALastVerifiedStep` BIGINT NULL;
