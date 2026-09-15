-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('SELL', 'BUY');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- Indexes for employees (from @@index)
CREATE INDEX "employees_role_idx" ON "employees"("role");
CREATE INDEX "employees_created_at_idx" ON "employees"("created_at");
CREATE INDEX "employees_name_idx" ON "employees"("name");
CREATE INDEX "employees_role_created_at_idx" ON "employees"("role", "created_at");
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "employees_name_trgm_idx" ON "employees" USING gin ("name" gin_trgm_ops);
CREATE INDEX "employees_email_trgm_idx" ON "employees" USING gin ("email" gin_trgm_ops);

-- CreateTable Product
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL,
    "karat" INTEGER NOT NULL DEFAULT 24,
    "weight_grams" DECIMAL(10,2) NOT NULL,
    "purity" DECIMAL(5,2),
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable Customer
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100),
    "phone" VARCHAR(20) NOT NULL,
    "nik" VARCHAR(16),
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable Transaction
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "invoice_no" VARCHAR(30) NOT NULL,
    "type" "TransactionType" NOT NULL DEFAULT 'SELL',
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "customer_id" INTEGER,
    "employee_id" INTEGER NOT NULL,
    "total_weight" DECIMAL(10,2) NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "paid_amount" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable TransactionItem
CREATE TABLE "transaction_items" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weight_grams" DECIMAL(10,2) NOT NULL,
    "price_at_sale" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");
CREATE UNIQUE INDEX "customers_nik_key" ON "customers"("nik");
CREATE UNIQUE INDEX "transactions_invoice_no_key" ON "transactions"("invoice_no");
CREATE UNIQUE INDEX "transaction_items_transaction_id_product_id_key" ON "transaction_items"("transaction_id", "product_id");

-- Indexes
CREATE INDEX "products_category_idx" ON "products"("category");
CREATE INDEX "products_is_active_idx" ON "products"("is_active");
CREATE INDEX "products_weight_grams_idx" ON "products"("weight_grams");
CREATE INDEX "customers_name_idx" ON "customers"("name");
CREATE INDEX "transactions_customer_id_idx" ON "transactions"("customer_id");
CREATE INDEX "transactions_employee_id_idx" ON "transactions"("employee_id");
CREATE INDEX "transactions_type_idx" ON "transactions"("type");
CREATE INDEX "transactions_status_idx" ON "transactions"("status");
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");
CREATE INDEX "transactions_customer_id_created_at_idx" ON "transactions"("customer_id", "created_at");
CREATE INDEX "transaction_items_product_id_idx" ON "transaction_items"("product_id");
CREATE INDEX "transaction_items_transaction_id_idx" ON "transaction_items"("transaction_id");

-- Foreign Keys
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
