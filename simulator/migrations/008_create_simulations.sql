-- 008_create_simulations.sql
-- Simulation state and experiment metadata tracking

CREATE TABLE IF NOT EXISTS simulations (
    simulation_id UUID PRIMARY KEY,
    experiment_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL,
    seed BIGINT,
    simulation_time TIMESTAMPTZ NOT NULL,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    configuration JSONB,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_simulations_experiment_id ON simulations (experiment_id);
CREATE INDEX IF NOT EXISTS idx_simulations_status ON simulations (status);
CREATE INDEX IF NOT EXISTS idx_simulations_created_at ON simulations (created_at DESC);
