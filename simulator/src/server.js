const express = require("express");

const config = require("./config/env");
const { testPostgresConnection } = require("./config/postgres");
const { connectMongoDB } = require("./config/mongodb");
const { connectKafka } = require("./config/kafka");

const routes = require("./api/routes");
const errorHandler = require("./api/middleware/errorHandler");
const OutboxRelay = require("./outbox/OutboxRelay");

const app = express();

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "synthetic-banking-simulator"
    });
});

// Simulator API Router
app.use("/api/v1/simulator", routes);

// Centralized error handling
app.use(errorHandler);

const outboxRelay = new OutboxRelay();

async function startServer() {
    try {
        await testPostgresConnection();
        await connectMongoDB();
        await connectKafka();

        // Start asynchronous outbox publisher relay
        outboxRelay.start(1000);

        const server = app.listen(config.port, () => {
            console.log(
                `Simulator running on http://localhost:${config.port}`
            );
        });

        const shutdown = async () => {
            console.log("\nGracefully shutting down simulator...");
            outboxRelay.stop();
            server.close(() => {
                console.log("Simulator HTTP server closed.");
                process.exit(0);
            });
        };

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);

        return server;
    } catch (error) {
        console.error("Failed to start simulator:", error);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = {
    app,
    startServer
};