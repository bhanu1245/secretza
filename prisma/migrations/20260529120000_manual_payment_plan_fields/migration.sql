-- AlterTable
ALTER TABLE "ManualPaymentSubmission" ADD COLUMN "planLabel" TEXT;
ALTER TABLE "ManualPaymentSubmission" ADD COLUMN "paymentMethod" TEXT DEFAULT 'upi';
