// simulator/tests/integration/api.test.js

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");

const { pool } = require("../../src/config/postgres");
const { connectMongoDB, client } = require("../../src/config/mongodb");
const { connectKafka, disconnectKafka } = require("../../src/config/kafka");
const { app } = require("../../src/server");

describe("HTTP REST API Integration Tests (/api/v1/simulator)", () => {
    let server;
    let baseUrl;

    before(async () => {
        await connectMongoDB();
        await connectKafka();
        
        server = http.createServer(app);
        await new Promise(resolve => server.listen(0, resolve));
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
    });

    after(async () => {
        await new Promise(resolve => server.close(resolve));
        await disconnectKafka();
        await pool.end();
        await client.close();
    });

    async function request(path, options = {}) {
        const url = `${baseUrl}${path}`;
        const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
        const res = await fetch(url, {
            method: options.method || "GET",
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        });
        const contentType = res.headers.get("content-type");
        let data = null;
        if (contentType && contentType.includes("application/json")) {
            data = await res.json();
        }
        return { status: res.status, data };
    }

    it("GET /health should return 200 ok", async () => {
        const res = await request("/health");
        assert.equal(res.status, 200);
        assert.equal(res.data.status, "ok");
    });

    it("Full API lifecycle: User -> Account -> Beneficiary -> Transaction via REST", async () => {
        // 1. Create User
        const userRes = await request("/api/v1/simulator/users", {
            method: "POST",
            body: {
                first_name: "APIUser",
                last_name: "One",
                email: `api_user_${Date.now()}@example.test`,
                phone: "+12025550001",
                date_of_birth: "1992-01-01"
            }
        });
        assert.equal(userRes.status, 201);
        const user1 = userRes.data;

        const user2Res = await request("/api/v1/simulator/users", {
            method: "POST",
            body: {
                first_name: "APIUser",
                last_name: "Two",
                email: `api_user2_${Date.now()}@example.test`,
                phone: "+12025550002",
                date_of_birth: "1993-02-02"
            }
        });
        assert.equal(user2Res.status, 201);
        const user2 = user2Res.data;

        // 2. Create Accounts
        const acc1Res = await request("/api/v1/simulator/accounts", {
            method: "POST",
            body: {
                user_id: user1.user_id,
                initial_balance: 3000.00
            }
        });
        assert.equal(acc1Res.status, 201);
        const acc1 = acc1Res.data;

        const acc2Res = await request("/api/v1/simulator/accounts", {
            method: "POST",
            body: {
                user_id: user2.user_id,
                initial_balance: 1000.00
            }
        });
        assert.equal(acc2Res.status, 201);
        const acc2 = acc2Res.data;

        // 3. Add Beneficiary
        const benRes = await request("/api/v1/simulator/beneficiaries", {
            method: "POST",
            body: {
                user_id: user1.user_id,
                target_account_id: acc2.account_id,
                nickname: "API Beneficiary"
            }
        });
        assert.equal(benRes.status, 201);

        // 4. Create Transaction
        const txRes = await request("/api/v1/simulator/transactions", {
            method: "POST",
            headers: {
                "Idempotency-Key": `api_idemp_${Date.now()}`
            },
            body: {
                sender_account_id: acc1.account_id,
                receiver_account_id: acc2.account_id,
                initiator_user_id: user1.user_id,
                amount: 500.00
            }
        });
        assert.equal(txRes.status, 201);
        assert.equal(txRes.data.status, "COMPLETED");

        // 5. Query updated account
        const updatedAcc1 = await request(`/api/v1/simulator/accounts/${acc1.account_id}`);
        assert.equal(updatedAcc1.status, 200);
        assert.equal(updatedAcc1.data.balance, 2500.00);

        // 6. Action interface test (Red Team action)
        const actionRes = await request("/api/v1/simulator/actions", {
            method: "POST",
            body: {
                action: "SIMULATE_LOGIN",
                simulation_id: "sim_test",
                parameters: {
                    user_id: user1.user_id,
                    success: true
                }
            }
        });
        assert.equal(actionRes.status, 200);
        assert.equal(actionRes.data.success, true);
        assert.equal(actionRes.data.action_type, "SIMULATE_LOGIN");
    });
});
