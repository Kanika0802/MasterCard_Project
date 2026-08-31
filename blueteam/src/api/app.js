// blueteam/src/api/app.js
"use strict";

const express = require("express");
const createDefenseRoutes = require("./routes/defenseRoutes");
const DefenseEngine = require("../DefenseEngine");

function createBlueTeamApp(defenseEngine = null) {
    const app = express();
    const engine = defenseEngine || new DefenseEngine();

    app.use(express.json());

    // Mount Blue Team defense API under /api/v1/defense
    app.use("/api/v1/defense", createDefenseRoutes(engine));

    // Global error handler
    app.use((err, req, res, next) => {
        const statusCode = err.statusCode || 500;
        res.status(statusCode).json({
            error: {
                message: err.message || "Internal Defense Error",
                code: err.errorCode || "BLUE_TEAM_ERROR"
            }
        });
    });

    app.defenseEngine = engine;
    return app;
}

module.exports = { createBlueTeamApp };
