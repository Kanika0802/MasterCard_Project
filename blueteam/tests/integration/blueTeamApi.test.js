// blueteam/tests/integration/blueTeamApi.test.js
"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("http");

const { createBlueTeamApp } = require("../../src/api/app");
const DefenseEngine = require("../../src/DefenseEngine");

describe("M3 Blue Team REST API Integration Tests", () => {
    let server;
    let baseUrl;
    let engine;

    before((t, done) => {
        engine = new DefenseEngine();
        const app = createBlueTeamApp(engine);
        server = http.createServer(app);
        server.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}/api/v1/defense`;
            done();
        });
    });

    after((t, done) => {
        if (server) {
            server.close(done);
        } else {
            done();
        }
    });

    it("GET /health should return 200 UP", async () => {
        const res = await fetch(`${baseUrl}/health`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.status, "UP");
        assert.strictEqual(data.module, "M3_BLUETEAM_DEFENSE");
    });

    it("POST /evaluate/transaction should evaluate risk and return decision", async () => {
        const payload = {
            transaction: {
                transaction_id: "tx_api_01",
                initiator_user_id: "usr_api_01",
                sender_account_id: "acc_api_01",
                receiver_account_id: "acc_api_02",
                amount: 15.00,
                channel: "MOBILE_APP"
            }
        };

        const res = await fetch(`${baseUrl}/evaluate/transaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.strictEqual(data.action, "ALLOW");
        assert.ok(data.risk_score.score < 0.30);
    });

    it("GET /rules should return active rule set", async () => {
        const res = await fetch(`${baseUrl}/rules`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data.rules));
        assert.ok(data.rules.length >= 7);
    });

    it("GET /metrics should return defense operational metrics", async () => {
        const res = await fetch(`${baseUrl}/metrics`);
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(data.stream !== undefined);
        assert.ok(data.alerts !== undefined);
        assert.ok(Array.isArray(data.models_loaded));
    });

    it("POST /alerts/:id/resolve should resolve alert in triage workflow", async () => {
        // First trigger an attack transaction to produce an alert
        const attackPayload = {
            transaction: {
                transaction_id: "tx_attack_api",
                initiator_user_id: "usr_victim_api",
                sender_account_id: "acc_victim_api",
                receiver_account_id: "acc_mule_api",
                amount: 25000.00,
                device_id: "dev_attack_unseen",
                channel: "WEB_PORTAL"
            }
        };

        const evalRes = await fetch(`${baseUrl}/evaluate/transaction`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(attackPayload)
        });
        const evalData = await evalRes.json();
        assert.ok(evalData.alert);

        const alertId = evalData.alert.alert_id;

        // Resolve the alert via API
        const resolveRes = await fetch(`${baseUrl}/alerts/${alertId}/resolve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason: "Customer confirmed unauthorized debit", author: "Lead_Investigator" })
        });

        assert.strictEqual(resolveRes.status, 200);
        const resolveData = await resolveRes.json();
        assert.strictEqual(resolveData.status, "RESOLVED");
        assert.strictEqual(resolveData.triage_notes.length, 1);
    });
});
