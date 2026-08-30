-- 006_add_indexes.sql
-- Performance and access pattern indexes for M1 PostgreSQL entities

-- ============================================================================
-- Accounts Indexes
-- Access patterns:
-- - Filter accounts by owner user_id (GET /accounts?user_id=...)
-- - Filter accounts by status (GET /accounts?status=...)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts (status);

-- ============================================================================
-- Merchants Indexes
-- Access patterns:
-- - Filter/join on settlement account foreign key
-- - Filter merchants by status
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_merchants_settlement_account_id ON merchants (settlement_account_id);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants (status);

-- ============================================================================
-- Beneficiaries Indexes
-- Access patterns:
-- - List beneficiaries for a user (GET /beneficiaries?user_id=...)
-- - Foreign key lookups on target_account_id
-- - List active/pending beneficiaries for a user (GET /beneficiaries?user_id=...&status=...)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_beneficiaries_user_id ON beneficiaries (user_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_target_account_id ON beneficiaries (target_account_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_user_status ON beneficiaries (user_id, status);

-- ============================================================================
-- Transactions Indexes
-- Access patterns:
-- - Transaction history by sender account (GET /transactions?account_id=...)
-- - Transaction history by receiver account
-- - Transaction history by merchant
-- - Transaction history by initiator user
-- - Filter transactions by status and timeframe
-- - Filter transactions by experiment context (GET /transactions?experiment_id=...)
-- - Device transaction telemetry lookups
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_sender_created ON transactions (sender_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_receiver_created ON transactions (receiver_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_created ON transactions (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_initiator_created ON transactions (initiator_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status_created ON transactions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_experiment_created ON transactions (experiment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_device_created ON transactions (device_id, created_at DESC);

-- ============================================================================
-- Ledger Entries Indexes
-- Access patterns:
-- - Foreign key lookups by transaction_id for reconciliation
-- - Account statement and balance history queries (account_id ordered by created_at)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries (transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_created ON ledger_entries (account_id, created_at DESC);
