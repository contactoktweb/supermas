-- ==============================================================================
-- 001_EXTENSIONS_AND_TYPES.sql
-- ERP SUPER MÁS S.A.S. - Supabase PostgreSQL
-- ==============================================================================

-- 1. Extensiones indispensables
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- 2. Enumerados y Tipos Controlados

-- Tipos de Ubicación / Sede
DO $$ BEGIN
    CREATE TYPE location_type AS ENUM ('WAREHOUSE', 'STORE_POINT', 'DISTRIBUTION_CENTER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tipos de Movimiento de Inventario / Kardex
DO $$ BEGIN
    CREATE TYPE inventory_movement_type AS ENUM (
        'PURCHASE_ENTRY',
        'SALE_OUT',
        'TRANSFER_IN',
        'TRANSFER_OUT',
        'POSITIVE_ADJUSTMENT',
        'NEGATIVE_ADJUSTMENT',
        'CUSTOMER_RETURN',
        'SUPPLIER_RETURN'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Salud de Stock
DO $$ BEGIN
    CREATE TYPE stock_health_status AS ENUM (
        'AVAILABLE',
        'LOW_STOCK',
        'CRITICAL',
        'OUT_OF_STOCK'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Métodos de Pago
DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM (
        'CASH',
        'CREDIT_CARD',
        'DEBIT_CARD',
        'BANK_TRANSFER',
        'CREDIT',
        'MIXED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de Venta
DO $$ BEGIN
    CREATE TYPE sale_status AS ENUM ('ISSUED', 'PENDING', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de Facturación Electrónica DIAN
DO $$ BEGIN
    CREATE TYPE dian_status_type AS ENUM (
        'PENDING',
        'SENT',
        'ACCEPTED',
        'REJECTED',
        'ACCEPTED_WITH_OBSERVATIONS'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de Remisiones
DO $$ BEGIN
    CREATE TYPE remission_status AS ENUM ('CREATED', 'DISPATCHED', 'DELIVERED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de Pedidos Web
DO $$ BEGIN
    CREATE TYPE web_order_fulfillment_status AS ENUM (
        'PENDING',
        'CONFIRMED',
        'PREPARING',
        'DISPATCHED',
        'DELIVERED',
        'CANCELLED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Estados de Asientos Contables
DO $$ BEGIN
    CREATE TYPE accounting_entry_status AS ENUM ('DRAFT', 'POSTED', 'REVERSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
