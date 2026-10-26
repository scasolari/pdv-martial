CREATE TABLE `ExternalConnectionLease` (
    `slot_id` INTEGER NOT NULL,
    `lease_token` VARCHAR(191) NULL,
    `expires_at` DATETIME(3) NULL,
    INDEX `ExternalConnectionLease_expires_at_idx` (`expires_at`),
    PRIMARY KEY (`slot_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ExternalConnectionLease` (`slot_id`) VALUES
    (1), (2), (3), (4), (5), (6), (7), (8),
    (9), (10), (11), (12), (13), (14), (15), (16),
    (17), (18), (19), (20), (21), (22), (23), (24),
    (25), (26), (27), (28), (29), (30), (31), (32);

CREATE INDEX `DatabaseAuditLog_createdAt_idx` ON `DatabaseAuditLog` (`createdAt`);
