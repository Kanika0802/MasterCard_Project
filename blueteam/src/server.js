// blueteam/src/server.js
"use strict";

const { createBlueTeamApp } = require("./api/app");
const DefenseEngine = require("./DefenseEngine");

const PORT = process.env.BLUE_TEAM_PORT || 4000;

async function startServer() {
    const defenseEngine = new DefenseEngine();
    const app = createBlueTeamApp(defenseEngine);

    const server = app.listen(PORT, () => {
        console.log(`[BlueTeam] Defense & Fraud Detection Engine listening on port ${PORT}`);
    });

    // Attempt Kafka stream startup if configured
    if (process.env.ENABLE_KAFKA_STREAM === "true") {
        try {
            await defenseEngine.startKafkaStream();
            console.log("[BlueTeam] Kafka stream consumer attached successfully.");
        } catch (err) {
            console.warn(`[BlueTeam] Kafka consumer failed to connect (continuing standalone): ${err.message}`);
        }
    }

    const shutdown = async () => {
        console.log("[BlueTeam] Shutting down defense server...");
        await defenseEngine.stopKafkaStream();
        server.close(() => {
            console.log("[BlueTeam] Server terminated cleanly.");
            process.exit(0);
        });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    return { app, server, defenseEngine };
}

if (require.main === module) {
    startServer().catch(err => {
        console.error("[BlueTeam] Fatal startup error:", err);
        process.exit(1);
    });
}

module.exports = { startServer };
