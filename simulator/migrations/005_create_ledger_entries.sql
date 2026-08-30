CREATE TABLE ledger_entries (
    ledger_entry_id UUID PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES transactions(transaction_id),
    account_id UUID NOT NULL REFERENCES accounts(account_id),
    entry_type VARCHAR(16) NOT NULL,
    amount NUMERIC(19,4) NOT NULL,
    balance_before NUMERIC(19,4) NOT NULL,
    balance_after NUMERIC(19,4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
