// blueteam/src/detectors/ml/StatisticalAnomalyDetector.js
"use strict";

class StatisticalAnomalyDetector {
    constructor(options = {}) {
        this.zScoreThreshold = options.zScoreThreshold || 3.0; // 3 sigma rule
        this.amountRatioThreshold = options.amountRatioThreshold || 4.0;
    }

    /**
     * Compute statistical anomaly score from extracted features
     */
    evaluate(features) {
        const zScore = Math.abs(features.amount_z_score || 0);
        const amountRatio = features.amount_to_avg_ratio || 1.0;
        const velocitySumRatio = (features.velocity_sum_1h || 0) / Math.max(1, (features.velocity_sum_24h || 1));

        let anomalyScore = 0.0;
        const factors = [];

        // 1. Z-Score component
        if (zScore > 1.5) {
            const zContrib = Math.min(1.0, (zScore - 1.5) / (this.zScoreThreshold - 1.5));
            anomalyScore += 0.5 * zContrib;
            if (zScore >= this.zScoreThreshold) {
                factors.push(`Transaction amount is ${zScore.toFixed(1)} standard deviations above baseline`);
            }
        }

        // 2. Relative Ratio component
        if (amountRatio >= this.amountRatioThreshold) {
            const ratioContrib = Math.min(1.0, (amountRatio - 1.0) / 10.0);
            anomalyScore += 0.3 * ratioContrib;
            factors.push(`Amount is ${amountRatio.toFixed(1)}x user historical average`);
        }

        // 3. Hourly concentration ratio
        if (velocitySumRatio > 0.7 && (features.velocity_count_1h || 0) >= 2) {
            anomalyScore += 0.2;
            factors.push("Unusual hourly concentration of daily transaction volume");
        }

        const score = Math.max(0.0, Math.min(1.0, Number(anomalyScore.toFixed(4))));

        return {
            model: "STATISTICAL_ZSCORE",
            score,
            is_anomaly: score >= 0.5,
            factors
        };
    }
}

module.exports = StatisticalAnomalyDetector;
