CREATE TABLE accounts (
    account_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    account_number VARCHAR(64) UNIQUE NOT NULL,
    account_type VARCHAR(32) NOT NULL,
    currency CHAR(3) NOT NULL,
    balance NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);