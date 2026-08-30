// simulator/src/api/controllers/DeviceController.js

const DeviceService = require("../../application/services/DeviceService");

class DeviceController {
    constructor(deviceService = new DeviceService()) {
        this.deviceService = deviceService;
    }

    list = async (req, res) => {
        const { user_id, status, limit, offset } = req.query;
        const devices = await this.deviceService.listDevices({
            userId: user_id,
            status,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0
        });
        res.status(200).json({
            items: devices.map(d => d.toJSON()),
            total: devices.length
        });
    };

    create = async (req, res) => {
        const device = await this.deviceService.registerDevice(req.body);
        res.status(201).json(device.toJSON());
    };

    getById = async (req, res) => {
        const { device_id } = req.params;
        const device = await this.deviceService.getDevice(device_id);
        res.status(200).json(device.toJSON());
    };

    update = async (req, res) => {
        const { device_id } = req.params;
        const updated = await this.deviceService.updateDevice(device_id, req.body);
        res.status(200).json(updated.toJSON());
    };

    retire = async (req, res) => {
        const { device_id } = req.params;
        await this.deviceService.retireDevice(device_id);
        res.status(204).send();
    };
}

module.exports = DeviceController;
