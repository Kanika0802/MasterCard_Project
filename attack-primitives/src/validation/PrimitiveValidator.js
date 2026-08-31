// attack-primitives/src/validation/PrimitiveValidator.js
"use strict";

const AttackPrimitive = require("../domain/AttackPrimitive");
const { PrimitiveValidationError } = require("../domain/errors");

class PrimitiveValidator {
    static validate(primitive) {
        const errors = [];

        if (!primitive || typeof primitive !== "object") {
            return { valid: false, errors: ["Primitive must be a non-null object."] };
        }

        try {
            if (!(primitive instanceof AttackPrimitive)) {
                new AttackPrimitive(primitive);
            }
        } catch (err) {
            errors.push(err.message);
        }

        // Additional semantic checks
        if (primitive.parameters && Array.isArray(primitive.parameters)) {
            const paramNames = new Set();
            for (const param of primitive.parameters) {
                if (paramNames.has(param.name)) {
                    errors.push(`Duplicate parameter name '${param.name}' found.`);
                }
                paramNames.add(param.name);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    static assertValid(primitive) {
        const result = PrimitiveValidator.validate(primitive);
        if (!result.valid) {
            throw new PrimitiveValidationError(
                `Primitive validation failed: ${result.errors.join("; ")}`,
                result.errors
            );
        }
        return true;
    }
}

module.exports = PrimitiveValidator;
