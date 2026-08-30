CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY,
    transaction_reference VARCHAR(128) UNIQUE NOT NULL,

    sender_account_id UUID REFERENCES accounts(account_id),
    receiver_account_id UUID REFERENCES accounts(account_id),
    merchant_id UUID REFERENCES merchants(merchant_id),

    initiator_user_id UUID NOT NULL,

    amount NUMERIC(19,4) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL,

    transaction_type VARCHAR(32) NOT NULL,
    channel VARCHAR(32) NOT NULL,

    device_id UUID,

    location JSONB,

    status VARCHAR(32) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,
    authorized_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    failure_reason TEXT,

    experiment_id VARCHAR(128)
);