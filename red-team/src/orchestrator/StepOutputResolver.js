// red-team/src/orchestrator/StepOutputResolver.js
"use strict";

const FORBIDDEN_PROPERTIES = new Set(["__proto__", "prototype", "constructor"]);

class StepOutputResolver {
    static TEST_PATTERN = /\{\{\s*steps\.([a-zA-Z0-9_\-]+)\.([a-zA-Z0-9_.[\]\-]+)\s*\}\}/;
    static REFERENCE_PATTERN = /\{\{\s*steps\.([a-zA-Z0-9_\-]+)\.([a-zA-Z0-9_.[\]\-]+)\s*\}\}/;
    static EXACT_REFERENCE_PATTERN = /^\{\{\s*steps\.([a-zA-Z0-9_\-]+)\.([a-zA-Z0-9_.[\]\-]+)\s*\}\}$/;

    /**
     * Index a completed StepResult's simulator_response into a structured lookup object
     * for downstream reference resolution.
     *
     * @param {object} stepResult - The completed StepResult instance or object
     * @returns {object} Indexed step output map
     */
    static indexStepOutput(stepResult) {
        if (!stepResult) return {};
        const resp = stepResult.simulator_response || {};
        const stateChanges = Array.isArray(resp.state_changes) ? resp.state_changes : [];
        const firstStateChange = stateChanges[0] || null;
        const firstData = (firstStateChange && typeof firstStateChange.data === "object" && firstStateChange.data !== null)
            ? firstStateChange.data
            : {};

        const output = {
            // Raw response fields
            ...(typeof resp === "object" && resp !== null ? resp : {}),

            // Direct shortcuts from first state change data if present
            ...(firstData || {}),

            // Top-level state change metadata
            ...(firstStateChange?.entity_id ? { entity_id: firstStateChange.entity_id } : {}),
            ...(firstStateChange?.entity_type ? { entity_type: firstStateChange.entity_type } : {}),
            ...(firstStateChange?.change ? { change: firstStateChange.change } : {}),

            // Explicit structures
            data: firstData,
            state_changes: stateChanges,
            state_change: firstStateChange,
            action_id: resp.action_id,
            action_type: resp.action_type,
            simulation_id: resp.simulation_id,
            experiment_id: resp.experiment_id,
            adversarial_metadata: resp.adversarial_metadata,
            simulator_response: resp,
            response: resp,
            status: stepResult.status,
            latency_ms: stepResult.latency_ms,
            error: resp.error || stepResult.error || null
        };

        return output;
    }

    /**
     * Retrieve a property value by dot/bracket path from an object
     * (e.g. "device_id", "data.device_id", "state_changes[0].entity_id", "state_changes.0.data.foo")
     *
     * @param {object} obj - Object to query
     * @param {string} pathStr - Property path string
     * @returns {*} Value or undefined
     */
    static getPathValue(obj, pathStr) {
        if (!obj || typeof obj !== "object" || !pathStr) {
            return undefined;
        }

        // Normalize array indexing: foo[0].bar -> foo.0.bar
        const normalized = pathStr.replace(/\[(\d+)\]/g, ".$1");
        const segments = normalized.split(".").filter(Boolean);

        let current = obj;
        for (const segment of segments) {
            if (FORBIDDEN_PROPERTIES.has(segment)) {
                return undefined;
            }
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[segment];
        }

        return current;
    }

    /**
     * Recursively resolve all reference expressions within an arbitrary value, object, or array
     * using the map of previously indexed step outputs.
     *
     * @param {*} value - The value to resolve (primitive, object, array)
     * @param {Record<string, object>} stepOutputsMap - Map of step_id -> indexed step output
     * @returns {*} The resolved value with references substituted
     */
    static resolve(value, stepOutputsMap = {}) {
        if (value === null || value === undefined) {
            return value;
        }

        if (Array.isArray(value)) {
            return value.map(item => StepOutputResolver.resolve(item, stepOutputsMap));
        }

        if (typeof value === "object") {
            const resolvedObj = {};
            for (const [k, v] of Object.entries(value)) {
                resolvedObj[k] = StepOutputResolver.resolve(v, stepOutputsMap);
            }
            return resolvedObj;
        }

        if (typeof value === "string") {
            // 1. Check for exact single reference (preserves original type e.g. number/boolean/object)
            const exactMatch = value.trim().match(StepOutputResolver.EXACT_REFERENCE_PATTERN);
            if (exactMatch) {
                const [, stepId, pathStr] = exactMatch;
                const stepOutput = stepOutputsMap[stepId];
                if (!stepOutput) {
                    throw new Error(`Unresolved step reference: Step '${stepId}' output is not available in execution context.`);
                }
                const resolvedVal = StepOutputResolver.getPathValue(stepOutput, pathStr);
                if (resolvedVal === undefined) {
                    throw new Error(`Unresolved step reference: Property '${pathStr}' not found in output of step '${stepId}'.`);
                }
                return resolvedVal;
            }

            // 2. Check for embedded string references
            if (value.includes("{{") && value.includes("}}")) {
                const globalPattern = new RegExp(StepOutputResolver.REFERENCE_PATTERN.source, "g");
                return value.replace(globalPattern, (fullMatch, stepId, pathStr) => {
                    const stepOutput = stepOutputsMap[stepId];
                    if (!stepOutput) {
                        throw new Error(`Unresolved step reference: Step '${stepId}' output is not available in execution context.`);
                    }
                    const resolvedVal = StepOutputResolver.getPathValue(stepOutput, pathStr);
                    if (resolvedVal === undefined) {
                        throw new Error(`Unresolved step reference: Property '${pathStr}' not found in output of step '${stepId}'.`);
                    }
                    return String(resolvedVal);
                });
            }
        }

        return value;
    }

    /**
     * Extract all reference metadata objects ({ step_id, path, raw }) found within a value
     *
     * @param {*} value - Value or object to scan
     * @returns {Array<{ raw: string, step_id: string, path: string }>}
     */
    static extractReferences(value) {
        const references = [];
        const visited = new Set();
        const globalPattern = new RegExp(StepOutputResolver.REFERENCE_PATTERN.source, "g");

        function recurse(val) {
            if (val === null || val === undefined) return;
            if (typeof val === "string") {
                const matches = val.matchAll(new RegExp(StepOutputResolver.REFERENCE_PATTERN.source, "g"));
                for (const match of matches) {
                    references.push({
                        raw: match[0],
                        step_id: match[1],
                        path: match[2]
                    });
                }
                return;
            }
            if (typeof val === "object") {
                if (visited.has(val)) return;
                visited.add(val);
                if (Array.isArray(val)) {
                    for (const item of val) recurse(item);
                } else {
                    for (const v of Object.values(val)) recurse(v);
                }
            }
        }

        recurse(value);
        return references;
    }

    /**
     * Check if a value contains any reference template expression
     *
     * @param {*} value
     * @returns {boolean}
     */
    static hasReference(value) {
        if (typeof value !== "string") return false;
        return StepOutputResolver.REFERENCE_PATTERN.test(value);
    }
}

module.exports = StepOutputResolver;
