// attack-primitives/src/domain/ParameterDefinition.js
"use strict";

const { ParameterType } = require("./constants");
const { ParameterConstraintError } = require("./errors");

class ParameterDefinition {
    constructor({
        name,
        type,
        description,
        required = true,
        default_value = undefined,
        enum_values = null,
        min = null,
        max = null,
        pattern = null
    }) {
        if (!name || typeof name !== "string") {
            throw new ParameterConstraintError("ParameterDefinition: 'name' must be a non-empty string.");
        }
        if (!type || !Object.values(ParameterType).includes(type)) {
            throw new ParameterConstraintError(
                `ParameterDefinition '${name}': invalid type '${type}'. Valid types: ${Object.values(ParameterType).join(", ")}`
            );
        }
        if (!description || typeof description !== "string") {
            throw new ParameterConstraintError(`ParameterDefinition '${name}': 'description' must be a non-empty string.`);
        }

        this.name = name;
        this.type = type;
        this.description = description;
        this.required = Boolean(required);
        this.default_value = default_value;
        this.enum_values = Array.isArray(enum_values) ? Object.freeze([...enum_values]) : null;
        this.min = typeof min === "number" ? min : null;
        this.max = typeof max === "number" ? max : null;
        this.pattern = pattern instanceof RegExp ? pattern : (pattern ? new RegExp(pattern) : null);

        Object.freeze(this);
    }

    validate(value) {
        // Check missing required
        if (value === undefined || value === null) {
            if (this.required) {
                throw new ParameterConstraintError(`Required parameter '${this.name}' is missing.`);
            }
            return this.default_value !== undefined ? this.default_value : null;
        }

        // Type check
        if (this.type === ParameterType.STRING) {
            if (typeof value !== "string") {
                throw new ParameterConstraintError(`Parameter '${this.name}' expected string, got ${typeof value}.`);
            }
            if (this.pattern && !this.pattern.test(value)) {
                throw new ParameterConstraintError(
                    `Parameter '${this.name}' value '${value}' does not match required pattern ${this.pattern}.`
                );
            }
        } else if (this.type === ParameterType.NUMBER) {
            if (typeof value !== "number" || isNaN(value)) {
                throw new ParameterConstraintError(`Parameter '${this.name}' expected number, got ${value}.`);
            }
            if (this.min !== null && value < this.min) {
                throw new ParameterConstraintError(`Parameter '${this.name}' value ${value} is below minimum ${this.min}.`);
            }
            if (this.max !== null && value > this.max) {
                throw new ParameterConstraintError(`Parameter '${this.name}' value ${value} exceeds maximum ${this.max}.`);
            }
        } else if (this.type === ParameterType.BOOLEAN) {
            if (typeof value !== "boolean") {
                throw new ParameterConstraintError(`Parameter '${this.name}' expected boolean, got ${typeof value}.`);
            }
        } else if (this.type === ParameterType.ARRAY) {
            if (!Array.isArray(value)) {
                throw new ParameterConstraintError(`Parameter '${this.name}' expected array, got ${typeof value}.`);
            }
        } else if (this.type === ParameterType.OBJECT) {
            if (typeof value !== "object" || Array.isArray(value)) {
                throw new ParameterConstraintError(`Parameter '${this.name}' expected object, got ${typeof value}.`);
            }
        }

        // Enum check
        if (this.enum_values && !this.enum_values.includes(value)) {
            throw new ParameterConstraintError(
                `Parameter '${this.name}' value '${value}' is invalid. Allowed: ${this.enum_values.join(", ")}`
            );
        }

        return value;
    }

    toJSON() {
        return {
            name: this.name,
            type: this.type,
            description: this.description,
            required: this.required,
            default: this.default_value !== undefined ? this.default_value : null,
            enum: this.enum_values ? Array.from(this.enum_values) : null,
            min: this.min,
            max: this.max,
            pattern: this.pattern ? this.pattern.source : null
        };
    }
}

module.exports = ParameterDefinition;
