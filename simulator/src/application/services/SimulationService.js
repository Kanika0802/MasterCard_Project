// simulator/src/application/services/SimulationService.js

const crypto = require("crypto");
const Simulation = require("../../domain/entities/Simulation");
const SimulationRepository = require("../../infrastructure/postgres/repositories/SimulationRepository");
const OutboxRepository = require("../../infrastructure/postgres/repositories/OutboxRepository");
const EventFactory = require("../../events/EventFactory");
const { SimulationStatus, EventType } = require("../../domain/constants");
const { NotFoundError, ValidationError } = require("../../domain/errors");

class SimulationService {
    constructor(
        simulationRepo = new SimulationRepository(),
        outboxRepo = new OutboxRepository()
    ) {
        this.simulationRepo = simulationRepo;
        this.outboxRepo = outboxRepo;
        this._simulationClocks = new Map(); // simulationId -> Date
    }

    async createSimulation({
        simulation_id = crypto.randomUUID(),
        experiment_id,
        seed = Date.now(),
        simulation_time = new Date(),
        configuration = {}
    }) {
        if (!experiment_id) {
            throw new ValidationError("experiment_id is required.");
        }

        const simulation = new Simulation({
            simulation_id,
            experiment_id,
            status: SimulationStatus.CREATED,
            seed,
            simulation_time,
            configuration
        });

        const created = await this.simulationRepo.create(simulation);
        this._simulationClocks.set(created.simulation_id, new Date(simulation_time));
        return created;
    }

    async getSimulation(simulationId) {
        const sim = await this.simulationRepo.findById(simulationId);
        if (!sim) {
            throw new NotFoundError("Simulation", simulationId);
        }
        return sim;
    }

    async startSimulation(simulationId) {
        const sim = await this.getSimulation(simulationId);
        const updated = await this.simulationRepo.updateStatus(simulationId, SimulationStatus.RUNNING);

        const event = EventFactory.create({
            event_type: EventType.SIMULATION_STARTED,
            entity_type: "simulation",
            entity_id: simulationId,
            simulation_id: simulationId,
            experiment_id: updated.experiment_id,
            payload: updated.toJSON()
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: simulationId,
            payload: event.toJSON()
        });

        return updated;
    }

    async completeSimulation(simulationId) {
        const sim = await this.getSimulation(simulationId);
        const updated = await this.simulationRepo.updateStatus(simulationId, SimulationStatus.COMPLETED);

        const event = EventFactory.create({
            event_type: EventType.SIMULATION_COMPLETED,
            entity_type: "simulation",
            entity_id: simulationId,
            simulation_id: simulationId,
            experiment_id: updated.experiment_id,
            payload: updated.toJSON()
        });

        await this.outboxRepo.insert({
            event_id: event.event_id,
            event_type: event.event_type,
            topic: EventFactory.getTopicForEventType(event.event_type),
            partition_key: simulationId,
            payload: event.toJSON()
        });

        return updated;
    }

    getSimulationClock(simulationId) {
        return this._simulationClocks.get(simulationId) || new Date();
    }

    advanceSimulationClock(simulationId, advanceSeconds) {
        const current = this.getSimulationClock(simulationId);
        const updated = new Date(current.getTime() + advanceSeconds * 1000);
        this._simulationClocks.set(simulationId, updated);
        return updated;
    }
}

module.exports = SimulationService;
