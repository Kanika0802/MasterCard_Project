// simulator/src/infrastructure/postgres/repositories/SimulationRepository.js

const { pool } = require("../../../config/postgres");
const Simulation = require("../../../domain/entities/Simulation");

class SimulationRepository {
    constructor(dbPool = pool) {
        this.pool = dbPool;
    }

    _mapRow(row) {
        if (!row) return null;
        return new Simulation({
            simulation_id: row.simulation_id,
            experiment_id: row.experiment_id,
            status: row.status,
            seed: row.seed,
            simulation_time: row.simulation_time,
            started_at: row.started_at,
            ended_at: row.ended_at,
            configuration: row.configuration,
            created_at: row.created_at
        });
    }

    async create(sim, client = null) {
        const db = client || this.pool;
        const query = `
            INSERT INTO simulations (
                simulation_id, experiment_id, status, seed, simulation_time, started_at, ended_at, configuration, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;
        const values = [
            sim.simulation_id,
            sim.experiment_id,
            sim.status,
            sim.seed,
            sim.simulation_time,
            sim.started_at,
            sim.ended_at,
            sim.configuration ? JSON.stringify(sim.configuration) : null,
            sim.created_at
        ];
        const res = await db.query(query, values);
        return this._mapRow(res.rows[0]);
    }

    async findById(simulationId, client = null) {
        const db = client || this.pool;
        const res = await db.query("SELECT * FROM simulations WHERE simulation_id = $1", [simulationId]);
        return this._mapRow(res.rows[0]);
    }

    async findByExperimentId(experimentId, client = null) {
        const db = client || this.pool;
        const res = await db.query("SELECT * FROM simulations WHERE experiment_id = $1 ORDER BY created_at DESC", [experimentId]);
        return res.rows.map(r => this._mapRow(r));
    }

    async updateStatus(simulationId, status, client = null) {
        const db = client || this.pool;
        const res = await db.query(
            `UPDATE simulations
             SET status = $1,
                 started_at = CASE WHEN $1 = 'RUNNING' AND started_at IS NULL THEN NOW() ELSE started_at END,
                 ended_at = CASE WHEN $1 IN ('COMPLETED', 'FAILED') THEN NOW() ELSE ended_at END
             WHERE simulation_id = $2
             RETURNING *`,
            [status, simulationId]
        );
        return this._mapRow(res.rows[0]);
    }
}

module.exports = SimulationRepository;
