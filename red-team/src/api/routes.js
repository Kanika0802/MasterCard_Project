// red-team/src/api/routes.js

const express = require("express");
const RedTeamExecutionController = require("./RedTeamExecutionController");

function createRedTeamRouter(options = {}) {
    const router = express.Router();
    const controller = new RedTeamExecutionController(options);

    router.post("/execute", controller.execute);

    return router;
}

module.exports = {
    createRedTeamRouter
};
