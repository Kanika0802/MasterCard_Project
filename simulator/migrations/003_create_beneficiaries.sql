CREATE TABLE beneficiaries (
    beneficiary_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    target_account_id UUID NOT NULL REFERENCES accounts(account_id),
    nickname VARCHAR(128),
    status VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);