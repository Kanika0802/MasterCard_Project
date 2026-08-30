-- 007_create_event_outbox.sql
-- Transactional Outbox for atomic domain event persistence and reliable Kafka publishing

CREATE TABLE IF NOT EXISTS event_outbox (
    outbox_id UUID PRIMARY KEY,
    event_id VARCHAR(128) UNIQUE NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    event_version INTEGER NOT NULL DEFAULT 1,
    topic VARCHAR(128) NOT NULL,
    partition_key VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ,
    last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_available ON event_outbox (status, available_at);
CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON event_outbox (created_at DESC);
