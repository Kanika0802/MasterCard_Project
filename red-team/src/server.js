// red-team/src/server.js
"use strict";

require("dotenv").config();

const { createRedTeamApp } = require("./api/app");

const PORT = Number(process.env.RED_TEAM_PORT) || 5000;

async function startServer(options = {}) {
    const app = createRedTeamApp(options);
    const port = options.port !== undefined ? options.port : PORT;

    const server = await new Promise((resolve, reject) => {
        const s = app.listen(port, () => {
            const addr = s.address();
            const actualPort = typeof addr === "object" && addr ? addr.port : port;
            console.log(`[RedTeam] Execution API server listening on port ${actualPort}`);
            resolve(s);
        });
        s.once("error", reject);
    });

    const shutdown = () => {
        console.log("\n[RedTeam] Shutting down Red Team execution server...");
        server.close(() => {
            console.log("[RedTeam] Server terminated cleanly.");
            process.exit(0);
        });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    return { app, server };
}

if (require.main === module) {
    startServer().catch(err => {
        console.error("[RedTeam] Fatal startup error:", err);
        process.exit(1);
    });
}

module.exports = {
    startServer,
    PORT
};
