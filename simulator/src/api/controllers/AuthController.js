// simulator/src/api/controllers/AuthController.js

const AuthenticationService = require("../../application/services/AuthenticationService");

class AuthController {
    constructor(authService = new AuthenticationService()) {
        this.authService = authService;
    }

    list = async (req, res) => {
        const { user_id, device_id, limit, offset } = req.query;
        const events = await this.authService.listAuthEvents({
            userId: user_id,
            deviceId: device_id,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0
        });
        res.status(200).json({
            items: events.map(e => e.toJSON()),
            total: events.length
        });
    };

    create = async (req, res) => {
        const event = await this.authService.recordAuthEvent(req.body);
        res.status(201).json(event.toJSON());
    };

    getById = async (req, res) => {
        const { event_id } = req.params;
        const event = await this.authService.getAuthEvent(event_id);
        res.status(200).json(event.toJSON());
    };

    delete = async (req, res) => {
        const { event_id } = req.params;
        await this.authService.deleteAuthEvent(event_id);
        res.status(204).send();
    };

    login = async (req, res) => {
        const result = await this.authService.simulateLogin(req.body);
        res.status(200).json(result.toJSON());
    };

    requestOtp = async (req, res) => {
        const result = await this.authService.simulateOtpRequest(req.body);
        res.status(200).json(result);
    };

    verifyOtp = async (req, res) => {
        const result = await this.authService.simulateOtpVerification(req.body);
        res.status(200).json(result.toJSON());
    };
}

module.exports = AuthController;
