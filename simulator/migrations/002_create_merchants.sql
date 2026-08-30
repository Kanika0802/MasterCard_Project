CREATE TABLE merchants (
    merchant_id UUID PRIMARY KEY,
    merchant_name VARCHAR(255) NOT NULL,
    merchant_category VARCHAR(64) NOT NULL,
    settlement_account_id UUID REFERENCES accounts(account_id),
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);