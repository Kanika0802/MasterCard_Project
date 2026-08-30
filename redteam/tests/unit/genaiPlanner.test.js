// redteam/tests/unit/genaiPlanner.test.js
//
// Unit tests for GenAIPlanner and ModelProvider implementations.

"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { GenAIPlanner, DEFAULT_SYSTEM_PROMPT } = require("../../src/planner/GenAIPlanner");
const {
    BaseModelProvider,
    MockModelProvider,
    FunctionModelProvider,
    HttpModelProvider
} = require("../../src/planner/ModelProvider");
const { PlannerInterface } = require("../../src/planner/PlannerInterface");
const { PrimitiveRegistry } = require("../../src/primitives/registry");
const { StrategyRegistry } = require("../../src/strategies/registry");
const { ScenarioValidator } = require("../../src/validation/ScenarioValidator");
const { ValidationError } = require("../../../simulator/src/domain/errors");
const PRIMITIVES = require("../../src/primitives/primitives");
const STRATEGIES = require("../../src/strategies/strategies");

function makeValidInput(overrides = {}) {
    const primReg = new PrimitiveRegistry(PRIMITIVES);
    const stratReg = new StrategyRegistry(STRATEGIES);
    return {
        objective: "Simulate a sophisticated device spoofing account takeover with fund siphoning",
        attack_family: "ACCOUNT_TAKEOVER",
        available_primitives: primReg.toSnapshot(),
        available_strategies: stratReg.toSnapshot(),
        target_context: {
            simulation_id: "sim_genai_001",
            experiment_id: "exp_genai_001",
            available_entities: {
                users: [
                    { user_id: "usr_victim_100", profile_status: "ACTIVE" },
                    { user_id: "usr_mule_200", profile_status: "ACTIVE" }
                ],
                accounts: [
                    { account_id: "acc_victim_100", user_id: "usr_victim_100", balance: 15000, status: "ACTIVE" },
                    { account_id: "acc_mule_200", user_id: "usr_mule_200", balance: 50, status: "ACTIVE" }
                ],
                merchants: [],
                devices: []
            }
        },
        constraints: {
            max_steps: 5,
            max_total_amount: 5000
        },
        planner_config: {
            model: "gemini-2.5-flash",
            temperature: 0.1
        },
        ...overrides
    };
}

describe("ModelProvider implementations", () => {
    it("BaseModelProvider throws if generate() is not implemented", async () => {
        const base = new BaseModelProvider();
        await assert.rejects(() => base.generate({ prompt: "test" }), Error);
    });

    it("FunctionModelProvider executes custom function", async () => {
        const fnProvider = new FunctionModelProvider(async ({ prompt }) => {
            return { echo: prompt };
        });
        const res = await fnProvider.generate({ prompt: "hello" });
        assert.deepEqual(res, { echo: "hello" });
    });

    it("FunctionModelProvider throws if not provided a function", () => {
        assert.throws(() => new FunctionModelProvider("not-a-func"), ValidationError);
    });

    it("MockModelProvider records call history and returns canned response", async () => {
        const mock = new MockModelProvider({ result: "canned" });
        const res = await mock.generate({ prompt: "run attack" });
        assert.deepEqual(res, { result: "canned" });
        assert.equal(mock.callHistory.length, 1);
        assert.equal(mock.callHistory[0].params.prompt, "run attack");
    });

    it("MockModelProvider allows dynamic response handler function", async () => {
        const mock = new MockModelProvider(params => ({ processed: params.prompt.toUpperCase() }));
        const res = await mock.generate({ prompt: "test" });
        assert.deepEqual(res, { processed: "TEST" });
    });

    it("HttpModelProvider throws if endpoint is missing", () => {
        assert.throws(() => new HttpModelProvider({}), ValidationError);
    });
});

describe("GenAIPlanner Architecture & Contract", () => {
    it("is an instance of PlannerInterface", () => {
        const planner = new GenAIPlanner();
        assert.ok(planner instanceof PlannerInterface);
    });

    it("has expected name incorporating modelName", () => {
        const planner = new GenAIPlanner({ modelName: "gemini-2.5-pro" });
        assert.equal(planner.name, "genai-planner-gemini-2.5-pro");
    });

    it("accepts a custom function as provider", async () => {
        const planner = new GenAIPlanner({
            provider: async () => ({
                scenarios: [
                    {
                        name: "Custom Function Scenario",
                        description: "Generated via function provider",
                        attack_family: "ACCOUNT_TAKEOVER",
                        severity: "HIGH",
                        strategy_id: null,
                        steps: [
                            {
                                primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                                parameters: { user_id: "usr_victim_100", device_type: "MOBILE" },
                                delay_ms: null,
                                depends_on: null,
                                on_failure: "ABORT",
                                description: "Device register"
                            }
                        ],
                        target_entities: {
                            user_ids: ["usr_victim_100"],
                            account_ids: ["acc_victim_100"],
                            device_ids: null,
                            merchant_ids: null
                        }
                    }
                ]
            })
        });

        const output = await planner.plan(makeValidInput());
        assert.equal(output.scenarios[0].name, "Custom Function Scenario");
    });

    it("does NOT connect to simulator, database, or Kafka", () => {
        const planner = new GenAIPlanner();
        assert.equal(typeof planner._simulator, "undefined");
        assert.equal(typeof planner._pg, "undefined");
        assert.equal(typeof planner._mongo, "undefined");
        assert.equal(typeof planner._kafka, "undefined");
    });
});

describe("GenAIPlanner Planning Execution", () => {
    it("generates structured PlannerOutput from valid model response", async () => {
        const mockResponse = {
            scenarios: [
                {
                    name: "Synthesized ATO & Mule Exfiltration",
                    description: "AI-planned multi-step ATO chain",
                    attack_family: "ACCOUNT_TAKEOVER",
                    severity: "CRITICAL",
                    strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
                    steps: [
                        {
                            primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                            parameters: {
                                user_id: "usr_victim_100",
                                device_type: "MOBILE",
                                ip_address: "203.0.113.42"
                            },
                            delay_ms: null,
                            depends_on: null,
                            on_failure: "ABORT",
                            description: "Register attacker device"
                        },
                        {
                            primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                            parameters: {
                                user_id: "usr_victim_100",
                                success: true
                            },
                            delay_ms: 200,
                            depends_on: ["step_000"],
                            on_failure: "ABORT",
                            description: "Simulate ATO login"
                        },
                        {
                            primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                            parameters: {
                                user_id: "usr_victim_100",
                                target_account_id: "acc_mule_200",
                                nickname: "Payroll Transfer"
                            },
                            delay_ms: 1000,
                            depends_on: ["step_001"],
                            on_failure: "ABORT",
                            description: "Add mule beneficiary"
                        },
                        {
                            primitive_id: "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
                            parameters: {
                                sender_account_id: "acc_victim_100",
                                receiver_account_id: "acc_mule_200",
                                initiator_user_id: "usr_victim_100",
                                amount: 4800,
                                channel: "MOBILE_APP"
                            },
                            delay_ms: 500,
                            depends_on: ["step_002"],
                            on_failure: "ABORT",
                            description: "Transfer siphoned funds"
                        }
                    ],
                    target_entities: {
                        user_ids: ["usr_victim_100"],
                        account_ids: ["acc_victim_100", "acc_mule_200"],
                        device_ids: null,
                        merchant_ids: null
                    },
                    reasoning: "Evades velocity triggers by pausing before the transfer."
                }
            ]
        };

        const planner = new GenAIPlanner({
            provider: new MockModelProvider(mockResponse, { modelName: "gemini-2.0-flash" }),
            modelName: "gemini-2.0-flash"
        });

        const input = makeValidInput();
        const output = await planner.plan(input);

        assert.equal(output.planner_id, "genai-planner-gemini-2.0-flash");
        assert.equal(output.model_used, "gemini-2.0-flash");
        assert.equal(output.objective, input.objective);
        assert.equal(output._simulation_id, "sim_genai_001");
        assert.equal(output._experiment_id, "exp_genai_001");
        assert.equal(output.scenarios.length, 1);
        assert.equal(output.scenarios[0].steps.length, 4);
    });

    it("parses markdown code-fenced JSON responses from LLM (```json ... ```)", async () => {
        const rawJsonString = `\`\`\`json
{
  "scenarios": [
    {
      "name": "Markdown Codeblock Scenario",
      "description": "Tested code fence stripping",
      "attack_family": "VELOCITY_ABUSE",
      "severity": "HIGH",
      "strategy_id": null,
      "steps": [
        {
          "primitive_id": "PRIM_EXECUTE_FRAUDULENT_TRANSFER",
          "parameters": {
            "sender_account_id": "acc_victim_100",
            "receiver_account_id": "acc_mule_200",
            "initiator_user_id": "usr_victim_100",
            "amount": 1000
          },
          "delay_ms": null,
          "depends_on": null,
          "on_failure": "ABORT",
          "description": "Transfer"
        }
      ],
      "target_entities": {
        "user_ids": ["usr_victim_100"],
        "account_ids": ["acc_victim_100", "acc_mule_200"],
        "device_ids": null,
        "merchant_ids": null
      },
      "reasoning": "Markdown wrapper test"
    }
  ]
}
\`\`\``;

        const planner = new GenAIPlanner({
            provider: new MockModelProvider(rawJsonString)
        });

        const output = await planner.plan(makeValidInput());
        assert.equal(output.scenarios[0].name, "Markdown Codeblock Scenario");
        assert.equal(output.scenarios[0].attack_family, "VELOCITY_ABUSE");
    });

    it("rejects invalid/malformed JSON string from model with ValidationError", async () => {
        const planner = new GenAIPlanner({
            provider: new MockModelProvider("This is not JSON at all. Error in generation.")
        });

        await assert.rejects(
            () => planner.plan(makeValidInput()),
            ValidationError
        );
    });

    it("rejects empty response from model", async () => {
        const planner = new GenAIPlanner({
            provider: new MockModelProvider("")
        });

        await assert.rejects(
            () => planner.plan(makeValidInput()),
            ValidationError
        );
    });

    it("rejects model output with no scenarios", async () => {
        const planner = new GenAIPlanner({
            provider: new MockModelProvider({ scenarios: [] })
        });

        await assert.rejects(
            () => planner.plan(makeValidInput()),
            ValidationError
        );
    });

    it("rejects malformed steps in model output", async () => {
        const badOutput = {
            scenarios: [
                {
                    name: "Bad Steps Scenario",
                    description: "Missing step fields",
                    attack_family: "ACCOUNT_TAKEOVER",
                    severity: "HIGH",
                    strategy_id: null,
                    steps: [
                        {
                            // missing primitive_id and parameters
                            description: "Invalid"
                        }
                    ],
                    target_entities: {
                        user_ids: ["usr_victim_100"],
                        account_ids: ["acc_victim_100"]
                    }
                }
            ]
        };

        const planner = new GenAIPlanner({
            provider: new MockModelProvider(badOutput)
        });

        await assert.rejects(
            () => planner.plan(makeValidInput()),
            ValidationError
        );
    });
});

describe("GenAIPlanner Validation Pipeline (planAndValidate)", () => {
    it("successfully runs planAndValidate() to produce VALIDATED AttackScenario", async () => {
        const validModelOutput = {
            scenarios: [
                {
                    name: "End-to-End ATO Scenario",
                    description: "Valid output that passes ScenarioValidator",
                    attack_family: "ACCOUNT_TAKEOVER",
                    severity: "HIGH",
                    strategy_id: "STRAT_ATO_NEW_DEVICE_FUND_DRAIN",
                    steps: [
                        {
                            primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                            parameters: {
                                user_id: "usr_victim_100",
                                device_type: "MOBILE"
                            },
                            delay_ms: null,
                            depends_on: null,
                            on_failure: "ABORT",
                            description: "Register device"
                        },
                        {
                            primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                            parameters: {
                                user_id: "usr_victim_100",
                                success: true
                            },
                            delay_ms: 100,
                            depends_on: ["step_000"],
                            on_failure: "ABORT",
                            description: "Login"
                        }
                    ],
                    target_entities: {
                        user_ids: ["usr_victim_100"],
                        account_ids: ["acc_victim_100"],
                        device_ids: null,
                        merchant_ids: null
                    },
                    reasoning: "Valid model output reasoning."
                }
            ]
        };

        const planner = new GenAIPlanner({
            provider: new MockModelProvider(validModelOutput)
        });

        const input = makeValidInput();
        const { plannerOutput, validScenarios, errors } = await planner.planAndValidate(input);

        assert.equal(errors.length, 0, `Expected 0 validation errors, got: ${errors.join("; ")}`);
        assert.equal(validScenarios.length, 1);
        assert.equal(validScenarios[0].status, "VALIDATED");
        assert.equal(validScenarios[0].generated_by, "GENAI_PLANNER");
        assert.equal(plannerOutput.validation_status, "VALID");
    });

    it("rejects hallucinated/unknown primitive_id in planAndValidate()", async () => {
        const hallucinatedOutput = {
            scenarios: [
                {
                    name: "Hallucinated Primitive Scenario",
                    description: "Contains non-existent primitive",
                    attack_family: "ACCOUNT_TAKEOVER",
                    severity: "HIGH",
                    strategy_id: null,
                    steps: [
                        {
                            primitive_id: "PRIM_HALLUCINATED_INVENTED_ACTION",
                            parameters: { fake_param: 123 },
                            delay_ms: null,
                            depends_on: null,
                            on_failure: "ABORT",
                            description: "Hallucination"
                        }
                    ],
                    target_entities: {
                        user_ids: ["usr_victim_100"],
                        account_ids: ["acc_victim_100"]
                    }
                }
            ]
        };

        const planner = new GenAIPlanner({
            provider: new MockModelProvider(hallucinatedOutput)
        });

        const { validScenarios, errors, plannerOutput } = await planner.planAndValidate(makeValidInput());

        assert.equal(validScenarios.length, 0);
        assert.ok(errors.length > 0);
        assert.ok(errors.some(e => e.includes("PRIM_HALLUCINATED_INVENTED_ACTION")));
        assert.equal(plannerOutput.validation_status, "INVALID");
    });

    it("rejects abstract primitive in planAndValidate()", async () => {
        const abstractOutput = {
            scenarios: [
                {
                    name: "Abstract Primitive Scenario",
                    description: "Contains abstract primitive",
                    attack_family: "ACCOUNT_TAKEOVER",
                    severity: "HIGH",
                    strategy_id: null,
                    steps: [
                        {
                            primitive_id: "PRIM_OTP_INTERCEPT",
                            parameters: { user_id: "usr_victim_100" },
                            delay_ms: null,
                            depends_on: null,
                            on_failure: "ABORT",
                            description: "Abstract step"
                        }
                    ],
                    target_entities: {
                        user_ids: ["usr_victim_100"],
                        account_ids: ["acc_victim_100"]
                    }
                }
            ]
        };

        const planner = new GenAIPlanner({
            provider: new MockModelProvider(abstractOutput)
        });

        const { validScenarios, errors } = await planner.planAndValidate(makeValidInput());

        assert.equal(validScenarios.length, 0);
        assert.ok(errors.some(e => e.includes("abstract") || e.includes("PRIM_OTP_INTERCEPT")));
    });

    it("rejects invalid/missing required parameters in planAndValidate()", async () => {
        const missingParamOutput = {
            scenarios: [
                {
                    name: "Missing Param Scenario",
                    description: "Missing required parameter target_account_id",
                    attack_family: "MULE_NETWORK",
                    severity: "HIGH",
                    strategy_id: null,
                    steps: [
                        {
                            primitive_id: "PRIM_ADD_MULE_BENEFICIARY",
                            parameters: {
                                user_id: "usr_victim_100"
                                // target_account_id is missing
                            },
                            delay_ms: null,
                            depends_on: null,
                            on_failure: "ABORT",
                            description: "Missing param"
                        }
                    ],
                    target_entities: {
                        user_ids: ["usr_victim_100"],
                        account_ids: ["acc_victim_100"]
                    }
                }
            ]
        };

        const planner = new GenAIPlanner({
            provider: new MockModelProvider(missingParamOutput)
        });

        const { validScenarios, errors } = await planner.planAndValidate(makeValidInput());

        assert.equal(validScenarios.length, 0);
        assert.ok(errors.some(e => e.includes("missing required parameters") || e.includes("target_account_id")));
    });

    it("rejects non-existent entity IDs not in simulation target context", async () => {
        const unknownEntityOutput = {
            scenarios: [
                {
                    name: "Unknown Entity Scenario",
                    description: "References user that doesn't exist in simulation context",
                    attack_family: "ACCOUNT_TAKEOVER",
                    severity: "HIGH",
                    strategy_id: null,
                    steps: [
                        {
                            primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                            parameters: {
                                user_id: "usr_GHOST_9999",
                                success: true
                            },
                            delay_ms: null,
                            depends_on: null,
                            on_failure: "ABORT",
                            description: "Ghost login"
                        }
                    ],
                    target_entities: {
                        user_ids: ["usr_GHOST_9999"],
                        account_ids: []
                    }
                }
            ]
        };

        const planner = new GenAIPlanner({
            provider: new MockModelProvider(unknownEntityOutput)
        });

        const { validScenarios, errors } = await planner.planAndValidate(makeValidInput());

        assert.equal(validScenarios.length, 0);
        assert.ok(errors.some(e => e.includes("usr_GHOST_9999")));
    });
});
