// attack-primitives/tests/unit/primitiveSchema.test.js
"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const AttackPrimitive = require("../../src/domain/AttackPrimitive");
const ParameterDefinition = require("../../src/domain/ParameterDefinition");
const {
    PrimitiveCategory,
    AttackFamily,
    ImpactSeverity,
    ExecutionType
} = require("../../src/domain/constants");
const { PrimitiveValidationError, ParameterConstraintError } = require("../../src/domain/errors");

describe("M3 AttackPrimitive & Parameter Schema Unit Tests", () => {

    describe("ParameterDefinition", () => {
        it("should accept valid parameter definitions", () => {
            const param = new ParameterDefinition({
                name: "amount",
                type: "number",
                description: "Transfer monetary sum",
                required: true,
                min: 0.01,
                max: 1000000
            });

            assert.strictEqual(param.name, "amount");
            assert.strictEqual(param.type, "number");
            assert.strictEqual(param.validate(500), 500);
        });

        it("should reject value below minimum", () => {
            const param = new ParameterDefinition({
                name: "amount",
                type: "number",
                description: "Transfer sum",
                min: 10
            });

            assert.throws(() => {
                param.validate(5);
            }, ParameterConstraintError);
        });

        it("should validate enum constraints", () => {
            const param = new ParameterDefinition({
                name: "status",
                type: "string",
                description: "Account status",
                enum_values: ["ACTIVE", "FROZEN"]
            });

            assert.strictEqual(param.validate("ACTIVE"), "ACTIVE");
            assert.throws(() => {
                param.validate("INVALID_STATUS");
            }, ParameterConstraintError);
        });

        it("should use default value when optional parameter is omitted", () => {
            const param = new ParameterDefinition({
                name: "currency",
                type: "string",
                description: "Currency code",
                required: false,
                default_value: "USD"
            });

            assert.strictEqual(param.validate(undefined), "USD");
        });
    });

    describe("AttackPrimitive Schema", () => {
        it("should instantiate a valid concrete attack primitive", () => {
            const prim = new AttackPrimitive({
                primitive_id: "PRIM_TEST_TRANSFER",
                name: "Test Transfer",
                description: "A test primitive",
                category: PrimitiveCategory.TRANSACTION,
                attack_family: AttackFamily.VELOCITY_ABUSE,
                execution_type: ExecutionType.CONCRETE,
                simulator_action: "PERFORM_TRANSACTION",
                parameters: [
                    { name: "amount", type: "number", description: "Transfer amount" }
                ],
                expected_success_events: ["TRANSACTION_COMPLETED"],
                stealth_score: 3,
                detection_risk: 0.5,
                financial_impact_severity: ImpactSeverity.HIGH
            });

            assert.strictEqual(prim.primitive_id, "PRIM_TEST_TRANSFER");
            assert.strictEqual(prim.is_abstract, false);
            assert.strictEqual(prim.simulator_action, "PERFORM_TRANSACTION");
        });

        it("should reject invalid primitive_id format", () => {
            assert.throws(() => {
                new AttackPrimitive({
                    primitive_id: "invalid_id_format",
                    name: "Invalid ID",
                    description: "Desc",
                    category: PrimitiveCategory.TRANSACTION,
                    attack_family: AttackFamily.VELOCITY_ABUSE
                });
            }, PrimitiveValidationError);
        });

        it("should reject concrete primitive with missing simulator_action", () => {
            assert.throws(() => {
                new AttackPrimitive({
                    primitive_id: "PRIM_CONCRETE_NO_ACTION",
                    name: "Missing Action",
                    description: "Desc",
                    category: PrimitiveCategory.TRANSACTION,
                    attack_family: AttackFamily.VELOCITY_ABUSE,
                    execution_type: ExecutionType.CONCRETE,
                    simulator_action: null
                });
            }, PrimitiveValidationError);
        });

        it("should reject abstract primitive with a non-null simulator_action", () => {
            assert.throws(() => {
                new AttackPrimitive({
                    primitive_id: "PRIM_ABSTRACT_WITH_ACTION",
                    name: "Abstract with Action",
                    description: "Desc",
                    category: PrimitiveCategory.TRANSACTION,
                    attack_family: AttackFamily.VELOCITY_ABUSE,
                    execution_type: ExecutionType.ABSTRACT,
                    simulator_action: "PERFORM_TRANSACTION"
                });
            }, PrimitiveValidationError);
        });
    });
});
