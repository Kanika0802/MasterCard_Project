// red-team/src/simulator-client/SimulatorClientError.js

const SimulatorClientErrorCode = Object.freeze({
    TIMEOUT: "TIMEOUT",
    NETWORK_ERROR: "NETWORK_ERROR",
    HTTP_ERROR: "HTTP_ERROR",
    INVALID_RESPONSE: "INVALID_RESPONSE",
    SIMULATOR_ERROR: "SIMULATOR_ERROR"
});

class SimulatorClientError extends Error {
    constructor({
        message,
        code = SimulatorClientErrorCode.SIMULATOR_ERROR,
        status = null,
        retryable = false,
        details = null,
        cause = null
    }) {
        super(message);
        this.name = "SimulatorClientError";
        this.code = code;
        this.status = status;
        this.retryable = Boolean(retryable);
        this.details = details;
        this.cause = cause;
        this.isSimulatorClientError = true;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, SimulatorClientError);
        }
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            status: this.status,
            retryable: this.retryable,
            details: this.details
        };
    }
}

module.exports = {
    SimulatorClientError,
    SimulatorClientErrorCode
};
