// simulator/src/api/controllers/UserController.js

const UserService = require("../../application/services/UserService");

class UserController {
    constructor(userService = new UserService()) {
        this.userService = userService;
    }

    list = async (req, res) => {
        const { status, limit, offset } = req.query;
        const users = await this.userService.listUsers({
            status,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : 0
        });
        res.status(200).json({
            items: users.map(u => u.toJSON()),
            total: users.length
        });
    };

    create = async (req, res) => {
        const user = await this.userService.createUser(req.body);
        res.status(201).json(user.toJSON());
    };

    getById = async (req, res) => {
        const { user_id } = req.params;
        const user = await this.userService.getUser(user_id);
        res.status(200).json(user.toJSON());
    };

    update = async (req, res) => {
        const { user_id } = req.params;
        const updated = await this.userService.updateUser(user_id, req.body);
        res.status(200).json(updated.toJSON());
    };

    deactivate = async (req, res) => {
        const { user_id } = req.params;
        await this.userService.deactivateUser(user_id);
        res.status(204).send();
    };
}

module.exports = UserController;
