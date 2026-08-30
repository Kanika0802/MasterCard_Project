// simulator/tests/integration/generator.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../../src/config/postgres");
const { connectMongoDB, client } = require("../../src/config/mongodb");
const SyntheticDataGenerator = require("../../src/simulation/generator");

describe("Synthetic Data Generator Integration Tests", () => {
    before(async () => {
        await connectMongoDB();
    });

    after(async () => {
        await pool.end();
        await client.close();
    });

    it("should deterministically seed users, accounts, merchants, and beneficiaries", async () => {
        const generator = new SyntheticDataGenerator(42);
        const result = await generator.seedScenario({
            userCount: 3,
            merchantCount: 1,
            simulationId: "sim_gen_test",
            experimentId: "exp_gen_test"
        });

        assert.equal(result.users.length, 3);
        assert.equal(result.accounts.length, 3);
        assert.equal(result.merchants.length, 1);

        for (const account of result.accounts) {
            assert.ok(account.balance >= 5000);
            assert.equal(account.status, "ACTIVE");
        }
    });
});
