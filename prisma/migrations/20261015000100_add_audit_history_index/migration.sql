CREATE INDEX `DatabaseAuditLog_user_id_database_id_createdAt_idx`
ON `DatabaseAuditLog` (`user_id`, `database_id`, `createdAt`);
