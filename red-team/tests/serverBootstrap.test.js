// red-team/tests/serverBootstrap.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { startServer, PORT } = require("../src/server");

describe("Red Team Server Bootstrap Unit & Integration Tests", () => {
    it("should export startServer function and PORT constant", () => {
        assert.equal(typeof startServer, "function");
        assert.equal(typeof PORT, "number");
        assert.ok(PORT > 0);
    });

    it("should bootstrap server on dynamic port and respond to /health endpoint", async () => {
        const { app, server } = await startServer({ port: 0 });
        try {
            assert.ok(server);
            assert.ok(app);

            const address = server.address();
            assert.ok(address);
            const port = address.port;
            assert.ok(port > 0);

            const response = await fetch(`http://127.0.0.1:${port}/health`);
            assert.equal(response.status, 200);

            const data = await response.json();
            assert.deepEqual(data, {
                status: "ok",
                service: "red-team-execution-api"
            });
        } finally {
            await new Promise(resolve => server.close(resolve));
        }
    });
});
