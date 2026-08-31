// blueteam/src/detectors/graph/GraphRiskAnalyzer.js
"use strict";

class GraphRiskAnalyzer {
    constructor() {
        this.modelName = "GRAPH_RISK_ANALYZER";
    }

    evaluate(features) {
        let score = 0.0;
        const reasons = [];

        if (features.cycle_detected) {
            score += 0.40;
            reasons.push("Circular money flow detected (cycle in transaction graph)");
        }

        if (features.min_distance_to_mule === 0) {
            score += 0.50;
            reasons.push("Account is identified as known mule entity");
        } else if (features.min_distance_to_mule === 1) {
            score += 0.35;
            reasons.push("Direct transaction adjacency to known mule entity");
        } else if (features.min_distance_to_mule === 2) {
            score += 0.15;
            reasons.push("2-hop proximity to confirmed mule entity");
        }

        const passThrough = features.pass_through_ratio || 0;
        if (passThrough > 0.85) {
            score += 0.30;
            reasons.push(`Rapid pass-through funds ratio: ${(passThrough * 100).toFixed(1)}%`);
        } else if (passThrough > 0.65) {
            score += 0.15;
            reasons.push(`Moderate pass-through funds ratio: ${(passThrough * 100).toFixed(1)}%`);
        }

        const fanRatio = features.fan_in_fan_out_ratio || 1;
        if (fanRatio > 5.0 || fanRatio < 0.2) {
            score += 0.10;
            reasons.push(`Significant fan-in/fan-out graph asymmetry (${fanRatio.toFixed(2)})`);
        }

        const clampedScore = Math.min(1.0, Math.max(0.0, Number(score.toFixed(4))));

        return {
            model: this.modelName,
            score: clampedScore,
            is_high_graph_risk: clampedScore >= 0.5,
            factors: reasons
        };
    }
}

module.exports = GraphRiskAnalyzer;
