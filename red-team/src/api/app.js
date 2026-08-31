// red-team/src/api/app.js

const express = require("express");
const { createRedTeamRouter } = require("./routes");

const path = require("path");

function createRedTeamApp(options = {}) {
    const app = express();

    // CORS Middleware
    app.use((req, res, next) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-simulation-id, x-experiment-id, x-correlation-id, x-causation-id");
        if (req.method === "OPTIONS") {
            return res.sendStatus(204);
        }
        next();
    });

    app.use(express.json());

    // Serve static dashboard UI files
    app.use(express.static(path.join(__dirname, "../public")));

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
