// simulator/src/domain/entities/Simulation.js

const { ValidationError } = require("../errors");
const { SimulationStatus } = require("../constants");

class Simulation {
    constructor({
        simulation_id,
        experiment_id,
        status = SimulationStatus.CREATED,
        seed = null,
        simulation_time = new Date(),
        started_at = null,
        ended_at = null,
        configuration = {},
        created_at = new Date()
    }) {
        this.simulation_id = simulation_id;
        this.experiment_id = experiment_id;
        this.status = status;
        this.seed = seed;
        this.simulation_time = simulation_time;
        this.started_at = started_at;
        this.ended_at = ended_at;
        this.configuration = configuration;
        this.created_at = created_at;

        this.validate();
    }

    validate() {
        if (!this.simulation_id) throw new ValidationError("simulation_id is required.");
        if (!this.experiment_id) throw new ValidationError("experiment_id is required.");
        if (!Object.values(SimulationStatus).includes(this.status)) {
            throw new ValidationError(`Invalid simulation status: ${this.status}`);
        }
    }

    start() {
        this.status = SimulationStatus.RUNNING;
        this.started_at = new Date();
    }

    pause() {
        this.status = SimulationStatus.PAUSED;
    }

    complete() {
        this.status = SimulationStatus.COMPLETED;
        this.ended_at = new Date();
    }

    fail() {
        this.status = SimulationStatus.FAILED;
        this.ended_at = new Date();
    }

    toJSON() {
        return {
            simulation_id: this.simulation_id,
            experiment_id: this.experiment_id,
            status: this.status,
            seed: this.seed,
            simulation_time: this.simulation_time,
            started_at: this.started_at,
            ended_at: this.ended_at,
            configuration: this.configuration,
            created_at: this.created_at
        };
    }
}

module.exports = Simulation;
