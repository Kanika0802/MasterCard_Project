// red-team/src/api/routes.js

const express = require("express");
const RedTeamExecutionController = require("./RedTeamExecutionController");

function createRedTeamRouter(options = {}) {
    const router = express.Router();
    const controller = new RedTeamExecutionController(options);
    const { runDemo } = require("../demo");

    router.post("/execute", controller.execute);

    router.post("/demo", async (req, res) => {
        try {
            const result = await runDemo();
            return res.status(200).json(result);
        } catch (err) {
            return res.status(500).json({
                error: {
                    code: "DEMO_EXECUTION_FAILED",
                    message: err.message
                }
            });
        }
    });

    router.get("/demo", async (req, res) => {
        try {
            const result = await runDemo();
            return res.status(200).json(result);
        } catch (err) {
            return res.status(500).json({
                error: {
                    code: "DEMO_EXECUTION_FAILED",
                    message: err.message
                }
            });
        }
    });

    return router;
}

module.exports = {
    createRedTeamRouter
};
