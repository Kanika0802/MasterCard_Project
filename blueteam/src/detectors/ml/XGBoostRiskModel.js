// blueteam/src/detectors/ml/XGBoostRiskModel.js
"use strict";

class XGBoostRiskModel {
    constructor() {
        this.modelName = "XGBOOST_TABULAR_RISK";
        this.baseScore = 0.15; // Prior base logit ~ -1.73

        // Calibrated Gradient Boosted Trees Ensemble
        this.trees = [
            // Tree 1: Velocity & Amount split
            {
                evaluate: (f) => {
                    if ((f.velocity_count_5m || 0) > 3) {
                        return (f.amount || 0) > 2000 ? 0.95 : 0.60;
                    } else {
                        return (f.amount || 0) > 5000 ? 0.40 : -0.25;
                    }
                }
            },
            // Tree 2: Device & Auth history
            {
                evaluate: (f) => {
                    if (f.is_new_device === true) {
                        return (f.consecutive_failed_logins || 0) > 0 ? 1.05 : 0.50;
                    } else {
                        return (f.consecutive_failed_logins || 0) > 2 ? 0.70 : -0.30;
                    }
                }
            },
            // Tree 3: Baseline ratio & Z-Score
            {
                evaluate: (f) => {
                    if ((f.amount_z_score || 0) > 2.5) {
                        return (f.amount_to_avg_ratio || 1) > 4.0 ? 0.85 : 0.45;
                    } else {
                        return -0.20;
                    }
                }
            },
            // Tree 4: Graph topology & Mule proximity
            {
                evaluate: (f) => {
                    if (f.cycle_detected === true || f.min_distance_to_mule === 0) {
                        return 1.10;
                    } else if ((f.pass_through_ratio || 0) > 0.75) {
                        return 0.75;
                    } else {
                        return -0.15;
                    }
                }
            },
            // Tree 5: Impossible travel & KYC integrity
            {
                evaluate: (f) => {
                    if ((f.geo_speed_kmh || 0) > 800) {
                        return 1.00;
                    } else if (f.is_kyc_tampered === true) {
                        return 0.95;
                    } else {
                        return -0.20;
                    }
                }
            }
        ];
    }

    _sigmoid(rawMargin) {
        return 1 / (1 + Math.exp(-rawMargin));
    }

    evaluate(features) {
        // Compute raw logit margin across boosted trees
        let rawLogit = Math.log(this.baseScore / (1 - this.baseScore));
        const treeContributions = [];

        for (let i = 0; i < this.trees.length; i++) {
            const treeOutput = this.trees[i].evaluate(features);
            rawLogit += treeOutput;
            treeContributions.push({ tree: i, contribution: Number(treeOutput.toFixed(4)) });
        }

        const calibratedProbability = this._sigmoid(rawLogit);
        const score = Number(calibratedProbability.toFixed(4));

        const factors = [];
        if (features.is_new_device) factors.push("Unrecognized device signature");
        if ((features.velocity_count_5m || 0) > 3) factors.push("Rapid transaction frequency");
        if ((features.amount_z_score || 0) > 2.5) factors.push("Significant deviation from user financial norm");
        if (features.cycle_detected || (features.pass_through_ratio || 0) > 0.75) factors.push("Mule flow network pattern");

        return {
            model: this.modelName,
            score,
            raw_logit: Number(rawLogit.toFixed(4)),
            tree_contributions: treeContributions,
            is_fraud_predicted: score >= 0.5,
            factors
        };
    }
}

module.exports = XGBoostRiskModel;
