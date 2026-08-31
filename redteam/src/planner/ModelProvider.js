// redteam/src/planner/ModelProvider.js
//
// Provider-agnostic model adapter abstraction for GenAIPlanner.
// Allows plugging in any LLM backend (Gemini, OpenAI, Anthropic, local, or mock)
// without hardcoding credentials or coupling M2 to external SDKs.

"use strict";

const { ValidationError } = require("../../../simulator/src/domain/errors");

/**
 * Base abstract class for LLM providers.
 */
class BaseModelProvider {
    /**
     * @param {object} [options]
     * @param {string} [options.modelName="genai-model"]
     */
    constructor(options = {}) {
        this.modelName = options.modelName || "genai-model";
    }

    /**
     * Generate text/JSON from prompts.
     * @param {object} params
     * @param {string} params.prompt
     * @param {string} [params.systemPrompt]
     * @param {number} [params.temperature]
     * @param {object} [params.schema]
     * @returns {Promise<string|object>}
     */
    async generate(params) { // eslint-disable-line no-unused-vars
        throw new Error("BaseModelProvider.generate() must be implemented by subclass.");
    }
}

/**
 * Function / Callback based model provider.
 * Wraps a custom async function `(prompt, systemPrompt, options) => response`.
 */
class FunctionModelProvider extends BaseModelProvider {
    /**
     * @param {Function} generateFn
     * @param {object} [options]
     */
    constructor(generateFn, options = {}) {
        super(options);
        if (typeof generateFn !== "function") {
            throw new ValidationError("FunctionModelProvider requires a valid generate function.");
        }
        this._generateFn = generateFn;
    }

    async generate(params) {
        return await this._generateFn(params);
    }
}

/**
 * Deterministic Mock Model Provider for testing.
 * Can return pre-configured responses or dynamic responses based on a handler.
 */
class MockModelProvider extends BaseModelProvider {
    /**
     * @param {object|string|Function} [cannedResponseOrFn]
     * @param {object} [options]
     */
    constructor(cannedResponseOrFn = null, options = {}) {
        super({ modelName: options.modelName || "mock-genai-v1", ...options });
        this._cannedResponse = cannedResponseOrFn;
        this.callHistory = [];
    }

    /**
     * Set a new canned response.
     * @param {object|string|Function} response
     */
    setResponse(response) {
        this._cannedResponse = response;
    }

    async generate(params) {
        this.callHistory.push({
            timestamp: new Date().toISOString(),
            params
        });

        if (typeof this._cannedResponse === "function") {
            return await this._cannedResponse(params);
        }

        if (this._cannedResponse !== null && this._cannedResponse !== undefined) {
            return this._cannedResponse;
        }

        // Default valid mock response structure
        return {
            scenarios: [
                {
                    name: "AI Generated Takeover Scenario",
                    description: `Adversarial plan synthesized for: ${params.prompt?.slice(0, 80) || "objective"}`,
                    attack_family: "ACCOUNT_TAKEOVER",
                    severity: "HIGH",
                    strategy_id: null,
                    steps: [
                        {
                            primitive_id: "PRIM_REGISTER_SPOOFED_DEVICE",
                            parameters: {
                                user_id: "usr_001",
                                device_type: "MOBILE"
                            },
                            delay_ms: null,
                            depends_on: null,
                            on_failure: "ABORT",
                            description: "Register spoofed mobile device"
                        },
                        {
                            primitive_id: "PRIM_ACCOUNT_TAKEOVER_LOGIN",
                            parameters: {
                                user_id: "usr_001",
                                success: true
                            },
                            delay_ms: 500,
                            depends_on: ["step_000"],
                            on_failure: "ABORT",
                            description: "Execute takeover login"
                        }
                    ],
                    target_entities: {
                        user_ids: ["usr_001"],
                        account_ids: ["acc_001"],
                        device_ids: null,
                        merchant_ids: null
                    },
                    reasoning: "Synthetic attack vector exploiting device trust and credentials."
                }
            ]
        };
    }
}

/**
 * Generic HTTP REST model provider (e.g. OpenAI / Gemini / Ollama / internal gateway compatible).
 * Uses native fetch without external dependencies.
 */
class HttpModelProvider extends BaseModelProvider {
    /**
     * @param {object} options
     * @param {string} options.endpoint - Full HTTP endpoint URL
     * @param {string} [options.apiKey] - Optional API Key
     * @param {string} [options.modelName] - Model identifier
     * @param {Function} [options.requestBuilder] - Custom function to map prompt -> HTTP body
     * @param {Function} [options.responseParser] - Custom function to map HTTP response -> string/object
     * @param {object} [options.headers] - Additional headers
     */
    constructor(options = {}) {
        super(options);
        if (!options.endpoint || typeof options.endpoint !== "string") {
            throw new ValidationError("HttpModelProvider requires a valid endpoint URL string.");
        }
        this.endpoint = options.endpoint;
        this.apiKey = options.apiKey || null;
        this.headers = options.headers || {};
        this.requestBuilder = options.requestBuilder || this._defaultRequestBuilder.bind(this);
        this.responseParser = options.responseParser || this._defaultResponseParser.bind(this);
    }

    _defaultRequestBuilder(params) {
        const headers = {
            "Content-Type": "application/json",
            ...this.headers
        };
        if (this.apiKey) {
            headers["Authorization"] = `Bearer ${this.apiKey}`;
        }

        const body = {
            model: this.modelName,
            messages: [
                ...(params.systemPrompt ? [{ role: "system", content: params.systemPrompt }] : []),
                { role: "user", content: params.prompt }
            ],
            temperature: params.temperature !== undefined ? params.temperature : 0.2
        };

        return { headers, body: JSON.stringify(body) };
    }

    async _defaultResponseParser(response) {
        const json = await response.json();
        if (!response.ok) {
            throw new ValidationError(
                `HttpModelProvider error (${response.status}): ${json?.error?.message || response.statusText}`
            );
        }
        // Support OpenAI / standard chat completions format
        const content = json?.choices?.[0]?.message?.content || json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {
            throw new ValidationError("HttpModelProvider: unable to extract text content from API response.");
        }
        return content;
    }

    async generate(params) {
        const { headers, body } = this.requestBuilder(params);
        const res = await fetch(this.endpoint, {
            method: "POST",
            headers,
            body
        });
        return await this.responseParser(res);
    }
}

module.exports = {
    BaseModelProvider,
    FunctionModelProvider,
    MockModelProvider,
    HttpModelProvider
};
