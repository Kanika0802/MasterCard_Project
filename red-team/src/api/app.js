// red-team/src/api/app.js

const express = require("express");
const { createRedTeamRouter } = require("./routes");

function createRedTeamApp(options = {}) {
    const app = express();

    app.use(express.json());

    // Health check endpoint for Red Team service
    app.get("/health", (req, res) => {
        res.status(200).json({
            status: "ok",
            service: "red-team-execution-api"
        });
    });

    app.use("/api/v1/red-team", createRedTeamRouter(options));

    // Handle body-parser / JSON parse errors gracefully
    app.use((err, req, res, next) => {
        if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "MALFORMED_JSON",
                    message: "Invalid JSON format in request body."
                }
            });
        }
        return res.status(500).json({
            success: false,
            error: {
                code: "INTERNAL_ERROR",
                message: "An unexpected error occurred."
            }
        });
    });

    return app;
}

module.exports = {
    createRedTeamApp
};
