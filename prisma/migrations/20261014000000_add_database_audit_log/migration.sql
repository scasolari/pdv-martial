CREATE TABLE `DatabaseAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `database_id` VARCHAR(191) NOT NULL,
    `database_name` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `table_name` VARCHAR(191) NULL,
    `affected_rows` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'started',
    `error_code` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `DatabaseAuditLog_user_id_createdAt_idx` (`user_id`, `createdAt`),
    INDEX `DatabaseAuditLog_database_id_createdAt_idx` (`database_id`, `createdAt`),
    INDEX `DatabaseAuditLog_status_createdAt_idx` (`status`, `createdAt`),
    PRIMARY KEY (`id`),
    CONSTRAINT `DatabaseAuditLog_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
