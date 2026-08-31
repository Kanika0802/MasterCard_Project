// blueteam/src/domain/errors.js
"use strict";

class BlueTeamError extends Error {
    constructor(message, errorCode = "BLUE_TEAM_ERROR", details = null) {
        super(message);
        this.name = this.constructor.name;
        this.errorCode = errorCode;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

class InvalidEventError extends BlueTeamError {
    constructor(message, details = null) {
        super(message, "INVALID_EVENT", details);
    }
}

class FeatureExtractionError extends BlueTeamError {
    constructor(message, details = null) {
        super(message, "FEATURE_EXTRACTION_ERROR", details);
    }
}

class DetectionError extends BlueTeamError {
    constructor(message, details = null) {
        super(message, "DETECTION_ERROR", details);
    }
}

class RuleExecutionError extends BlueTeamError {
    constructor(message, details = null) {
        super(message, "RULE_EXECUTION_ERROR", details);
    }
}

class PolicyDecisionError extends BlueTeamError {
    constructor(message, details = null) {
        super(message, "POLICY_DECISION_ERROR", details);
    }
}

class AlertError extends BlueTeamError {
    constructor(message, details = null) {
        super(message, "ALERT_ERROR", details);
    }
}

module.exports = {
    BlueTeamError,
    InvalidEventError,
    FeatureExtractionError,
    DetectionError,
    RuleExecutionError,
    PolicyDecisionError,
    AlertError
};
