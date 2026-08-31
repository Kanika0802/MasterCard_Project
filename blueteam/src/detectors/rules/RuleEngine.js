// blueteam/src/detectors/rules/RuleEngine.js
"use strict";

const VelocityRule = require("./VelocityRule");
const ImpossibleTravelRule = require("./ImpossibleTravelRule");
const NewDeviceHighValueRule = require("./NewDeviceHighValueRule");
const AuthBruteForceRule = require("./AuthBruteForceRule");
const MulePassThroughRule = require("./MulePassThroughRule");
const KycTamperingRule = require("./KycTamperingRule");
const AccountFreezeRule = require("./AccountFreezeRule");

class RuleEngine {
    constructor(rules = null) {
        this.rules = rules || [
            new VelocityRule(),
            new ImpossibleTravelRule(),
            new NewDeviceHighValueRule(),
            new AuthBruteForceRule(),
            new MulePassThroughRule(),
            new KycTamperingRule(),
            new AccountFreezeRule()
        ];
    }

    addRule(rule) {
        if (rule && typeof rule.evaluate === "function") {
            this.rules.push(rule);
        }
    }

    getRules() {
        return this.rules.map(r => ({
            id: r.id,
            name: r.name,
            category: r.category,
            weight: r.weight
        }));
    }

    evaluate(features, event) {
        const triggeredRules = [];
        let maxScore = 0.0;
        let sumScore = 0.0;

        for (const rule of this.rules) {
            try {
                const result = rule.evaluate(features, event);
                if (result.triggered) {
                    triggeredRules.push(result);
                    if (result.score > maxScore) maxScore = result.score;
                    sumScore += result.score;
                }
            } catch (err) {
                // Keep engine resilient to single-rule failures
            }
        }

        // Composite rule score: soft non-linear combination
        const compositeScore = triggeredRules.length === 0
            ? 0.0
            : Math.min(1.0, maxScore + 0.1 * (triggeredRules.length - 1));

        return {
            score: Number(compositeScore.toFixed(4)),
            triggered_rules: triggeredRules,
            count: triggeredRules.length
        };
    }
}

module.exports = RuleEngine;
