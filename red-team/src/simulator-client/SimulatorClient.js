// red-team/src/simulator-client/SimulatorClient.js

const { SimulatorClientError, SimulatorClientErrorCode } = require("./SimulatorClientError");

const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 502, 503, 504]);

class SimulatorClient {
    constructor(options = {}) {
        const rawBaseUrl = options.baseUrl || process.env.SIMULATOR_BASE_URL || "http://localhost:3000";
        this.baseUrl = this._normalizeBaseUrl(rawBaseUrl);

        const rawTimeout = options.timeoutMs !== undefined
            ? options.timeoutMs
            : parseInt(process.env.SIMULATOR_REQUEST_TIMEOUT_MS || "5000", 10);
        if (typeof rawTimeout !== "number" || isNaN(rawTimeout) || rawTimeout <= 0) {
            throw new Error(`Invalid SIMULATOR_REQUEST_TIMEOUT_MS: ${rawTimeout}. Must be a positive integer.`);
        }
        this.timeoutMs = rawTimeout;

        const rawRetries = options.maxRetries !== undefined
            ? options.maxRetries
            : parseInt(process.env.SIMULATOR_MAX_RETRIES || "2", 10);
        if (typeof rawRetries !== "number" || isNaN(rawRetries) || rawRetries < 0) {
            throw new Error(`Invalid SIMULATOR_MAX_RETRIES: ${rawRetries}. Must be a non-negative integer.`);
        }
        this.maxRetries = rawRetries;

        this.retryDelayMs = options.retryDelayMs !== undefined ? options.retryDelayMs : 50;
        this.fetchFn = options.fetchFn || globalThis.fetch;
    }

    _normalizeBaseUrl(url) {
        if (!url || typeof url !== "string") {
            throw new Error("SimulatorClient requires a valid string baseUrl.");
        }
        const trimmed = url.trim();
        try {
            const parsed = new URL(trimmed);
            return trimmed.replace(/\/+$/, "");
        } catch (e) {
            throw new Error(`Invalid baseUrl provided to SimulatorClient: '${url}'`);
        }
    }

    async executeAction(actionRequest) {
        if (!actionRequest || typeof actionRequest !== "object") {
            throw new SimulatorClientError({
                message: "actionRequest must be an object",
                code: SimulatorClientErrorCode.SIMULATOR_ERROR,
                retryable: false
            });
        }

        const {
            action,
            parameters = {},
            simulation_id = "default_sim",
            experiment_id = "default_exp",
            adversarial_metadata = null,
            idempotency_key = null,
            correlation_id = null,
            causation_id = null,
            timeout_ms = this.timeoutMs
        } = actionRequest;

        if (!action || typeof action !== "string" || !action.trim()) {
            throw new SimulatorClientError({
                message: "action is required and must be a non-empty string",
                code: SimulatorClientErrorCode.SIMULATOR_ERROR,
                retryable: false
            });
        }

        const effectiveTimeout = (typeof timeout_ms === "number" && timeout_ms > 0) ? timeout_ms : this.timeoutMs;
        const targetUrl = `${this.baseUrl}/api/v1/simulator/actions`;

        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        if (idempotency_key) {
            headers["Idempotency-Key"] = String(idempotency_key);
        }
        if (correlation_id) {
            headers["X-Correlation-Id"] = String(correlation_id);
        }
        if (causation_id) {
            headers["X-Causation-Id"] = String(causation_id);
        }

        const payloadBody = JSON.stringify({
            action,
            simulation_id,
            experiment_id,
            parameters,
            adversarial_metadata
        });

        let attempts = 0;
        const maxAttempts = 1 + this.maxRetries;
        let lastError = null;

        while (attempts < maxAttempts) {
            attempts++;
            try {
                const response = await this._sendHttpRequest(targetUrl, {
                    method: "POST",
                    headers,
                    body: payloadBody,
                    timeoutMs: effectiveTimeout
                });

                return await this._parseAndValidateActionResponse(response);
            } catch (err) {
                lastError = err instanceof SimulatorClientError
                    ? err
                    : this._normalizeError(err);

                const isLastAttempt = attempts >= maxAttempts;
                if (!lastError.retryable || isLastAttempt) {
                    throw lastError;
                }

                if (this.retryDelayMs > 0) {
                    await this._sleep(this.retryDelayMs);
                }
            }
        }

        throw lastError;
    }

    async checkHealth({ timeout_ms = this.timeoutMs } = {}) {
        const targetUrl = `${this.baseUrl}/health`;
        try {
            const response = await this._sendHttpRequest(targetUrl, {
                method: "GET",
                headers: { "Accept": "application/json" },
                timeoutMs: timeout_ms
            });

            if (!response.ok) {
                throw new SimulatorClientError({
                    message: `Simulator health check failed with status ${response.status}`,
                    code: SimulatorClientErrorCode.HTTP_ERROR,
                    status: response.status,
                    retryable: RETRYABLE_HTTP_STATUSES.has(response.status)
                });
            }

            const data = await response.json();
            if (!data || data.status !== "ok") {
                throw new SimulatorClientError({
                    message: "Malformed health check response from simulator",
                    code: SimulatorClientErrorCode.INVALID_RESPONSE,
                    details: data
                });
            }

            return data;
        } catch (err) {
            if (err instanceof SimulatorClientError) throw err;
            throw this._normalizeError(err);
        }
    }

    async _sendHttpRequest(url, { method, headers, body, timeoutMs }) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            return await this.fetchFn(url, {
                method,
                headers,
                body,
                signal: controller.signal
            });
        } catch (err) {
            if (err.name === "AbortError" || controller.signal.aborted) {
                throw new SimulatorClientError({
                    message: `Request to ${url} timed out after ${timeoutMs}ms`,
                    code: SimulatorClientErrorCode.TIMEOUT,
                    retryable: true,
                    cause: err
                });
            }

            throw new SimulatorClientError({
                message: `Network request to ${url} failed: ${err.message}`,
                code: SimulatorClientErrorCode.NETWORK_ERROR,
                retryable: true,
                cause: err
            });
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async _parseAndValidateActionResponse(response) {
        let responseBody;
        try {
            responseBody = await response.json();
        } catch (parseErr) {
            throw new SimulatorClientError({
                message: `Failed to parse simulator response as JSON (HTTP ${response.status})`,
                code: SimulatorClientErrorCode.INVALID_RESPONSE,
                status: response.status,
                retryable: false,
                cause: parseErr
            });
        }

        // Validate response structure matching 03_api_contract & ActionController
        if (!responseBody || typeof responseBody !== "object" || Array.isArray(responseBody)) {
            throw new SimulatorClientError({
                message: "Simulator response is not a valid JSON object",
                code: SimulatorClientErrorCode.INVALID_RESPONSE,
                status: response.status,
                details: responseBody
            });
        }

        if (typeof responseBody.success !== "boolean") {
            throw new SimulatorClientError({
                message: "Simulator response missing boolean 'success' field",
                code: SimulatorClientErrorCode.INVALID_RESPONSE,
                status: response.status,
                details: responseBody
            });
        }

        if (response.status >= 400 || responseBody.success === false) {
            const isRetryable = RETRYABLE_HTTP_STATUSES.has(response.status);
            const errDetails = responseBody.error || {};
            const message = errDetails.message || `Simulator returned HTTP ${response.status}`;
            const errorCode = response.status >= 500
                ? SimulatorClientErrorCode.HTTP_ERROR
                : SimulatorClientErrorCode.SIMULATOR_ERROR;

            throw new SimulatorClientError({
                message,
                code: errorCode,
                status: response.status,
                retryable: isRetryable,
                details: responseBody
            });
        }

        if (!Array.isArray(responseBody.state_changes)) {
            throw new SimulatorClientError({
                message: "Simulator successful response missing array 'state_changes'",
                code: SimulatorClientErrorCode.INVALID_RESPONSE,
                status: response.status,
                details: responseBody
            });
        }

        return responseBody;
    }

    _normalizeError(err) {
        if (err instanceof SimulatorClientError) {
            return err;
        }

        if (err.name === "AbortError") {
            return new SimulatorClientError({
                message: "Request timed out",
                code: SimulatorClientErrorCode.TIMEOUT,
                retryable: true,
                cause: err
            });
        }

        return new SimulatorClientError({
            message: err.message || "Unknown simulator client error",
            code: SimulatorClientErrorCode.NETWORK_ERROR,
            retryable: true,
            cause: err
        });
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = SimulatorClient;
