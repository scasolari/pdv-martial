/*
  Warnings:

  - You are about to drop the column `hasTwoFactorCompleted` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `hasTwoFactorCompleted`,
    ADD COLUMN `is2FAActive` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `is2FAEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `twoFASecret` LONGTEXT NULL;
