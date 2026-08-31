// attack-primitives/src/domain/errors.js
"use strict";

class PrimitiveError extends Error {
    constructor(message, errorCode = "PRIMITIVE_ERROR", details = null) {
        super(message);
        this.name = this.constructor.name;
        this.errorCode = errorCode;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

class PrimitiveValidationError extends PrimitiveError {
    constructor(message, details = null) {
        super(message, "PRIMITIVE_VALIDATION_ERROR", details);
    }
}

class ParameterConstraintError extends PrimitiveError {
    constructor(message, details = null) {
        super(message, "PARAMETER_CONSTRAINT_ERROR", details);
    }
}

class PreconditionViolationError extends PrimitiveError {
    constructor(message, details = null) {
        super(message, "PRECONDITION_VIOLATION_ERROR", details);
    }
}

class ActionMappingError extends PrimitiveError {
    constructor(message, details = null) {
        super(message, "ACTION_MAPPING_ERROR", details);
    }
}

module.exports = {
    PrimitiveError,
    PrimitiveValidationError,
    ParameterConstraintError,
    PreconditionViolationError,
    ActionMappingError
};
