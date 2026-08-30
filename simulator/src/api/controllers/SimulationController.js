// simulator/src/api/controllers/SimulationController.js

const SimulationService = require("../../application/services/SimulationService");

class SimulationController {
    constructor(simulationService = new SimulationService()) {
        this.simulationService = simulationService;
    }

    create = async (req, res) => {
        const sim = await this.simulationService.createSimulation(req.body);
        res.status(201).json(sim.toJSON());
    };

    getById = async (req, res) => {
        const { simulation_id } = req.params;
        const sim = await this.simulationService.getSimulation(simulation_id);
        res.status(200).json(sim.toJSON());
    };

    start = async (req, res) => {
        const { simulation_id } = req.params;
        const sim = await this.simulationService.startSimulation(simulation_id);
        res.status(200).json(sim.toJSON());
    };

    complete = async (req, res) => {
        const { simulation_id } = req.params;
        const sim = await this.simulationService.completeSimulation(simulation_id);
        res.status(200).json(sim.toJSON());
    };

    getClock = async (req, res) => {
        const { simulation_id } = req.params;
        const clock = this.simulationService.getSimulationClock(simulation_id);
        res.status(200).json({
            simulation_id,
            simulation_time: clock.toISOString()
        });
    };
}

module.exports = SimulationController;
