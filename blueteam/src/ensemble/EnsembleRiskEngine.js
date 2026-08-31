// blueteam/src/ensemble/EnsembleRiskEngine.js
"use strict";

const RiskScore = require("../domain/entities/RiskScore");
const { DefaultEnsembleWeights, DefaultRiskThresholds, RiskTier } = require("../domain/constants");
const RuleEngine = require("../detectors/rules/RuleEngine");
const XGBoostRiskModel = require("../detectors/ml/XGBoostRiskModel");
const AutoencoderDetector = require("../detectors/ml/AutoencoderDetector");
const StatisticalAnomalyDetector = require("../detectors/ml/StatisticalAnomalyDetector");
const GraphRiskAnalyzer = require("../detectors/graph/GraphRiskAnalyzer");
const DeviceFingerprintDetector = require("../detectors/identity/DeviceFingerprintDetector");
const DocumentKycDetector = require("../detectors/identity/DocumentKycDetector");

class EnsembleRiskEngine {
    constructor(options = {}) {
        this.weights = { ...DefaultEnsembleWeights, ...(options.weights || {}) };
        this.thresholds = { ...DefaultRiskThresholds, ...(options.thresholds || {}) };

        this.ruleEngine = options.ruleEngine || new RuleEngine();
        this.xgboostModel = options.xgboostModel || new XGBoostRiskModel();
        this.autoencoder = options.autoencoder || new AutoencoderDetector();
        this.statisticalDetector = options.statisticalDetector || new StatisticalAnomalyDetector();
        this.graphAnalyzer = options.graphAnalyzer || new GraphRiskAnalyzer();
        this.deviceDetector = options.deviceDetector || new DeviceFingerprintDetector();
        this.kycDetector = options.kycDetector || new DocumentKycDetector();
    }

    evaluate(features, event = {}) {
        // 1. Run Rule Engine
        const ruleResult = this.ruleEngine.evaluate(features, event);

        // 2. Run Tabular XGBoost ML Model
        const xgbResult = this.xgboostModel.evaluate(features);

        // 3. Run Autoencoder & Statistical Anomaly Models
        const aeResult = this.autoencoder.evaluate(features);
        const statResult = this.statisticalDetector.evaluate(features);
        const combinedAnomalyScore = Math.max(aeResult.score, statResult.score);

        // 4. Run Graph Risk Analyzer
        const graphResult = this.graphAnalyzer.evaluate(features);

        // 5. Run Identity / Device Detectors
        const deviceResult = this.deviceDetector.evaluate(features, event);
        const kycResult = this.kycDetector.evaluate(features, event);
        const combinedIdentityScore = Math.max(deviceResult.score, kycResult.score);

        // 6. Compute Weighted Ensemble Score
        const wRules = this.weights.rules;
        const wXgb = this.weights.ml_tabular;
        const wAe = this.weights.autoencoder;
        const wGraph = this.weights.graph;
        const wIdent = this.weights.identity;
        const totalWeight = wRules + wXgb + wAe + wGraph + wIdent;

        let compositeScore = (
            ruleResult.score * wRules +
            xgbResult.score * wXgb +
            combinedAnomalyScore * wAe +
            graphResult.score * wGraph +
            combinedIdentityScore * wIdent
        ) / totalWeight;

        // Peak Component Fusion: prevent dilution when high-confidence detectors fire
        const maxComponentScore = Math.max(
            ruleResult.score,
            xgbResult.score,
            combinedAnomalyScore,
            graphResult.score,
            combinedIdentityScore
        );

        if (maxComponentScore >= 0.70) {
            compositeScore = 0.4 * compositeScore + 0.6 * maxComponentScore;
        }

        // Hard Override: If any critical high-confidence rule triggers (>= 0.85)
        if (ruleResult.triggered_rules.some(r => r.score >= 0.85)) {
            compositeScore = Math.max(compositeScore, ruleResult.score);
        }

        // Clamp between 0.0 and 1.0
        const finalScore = Math.min(1.0, Math.max(0.0, Number(compositeScore.toFixed(4))));
        const riskTier = RiskScore.calculateTier(finalScore, this.thresholds);

        // 7. Aggregate Explanations & Factor Attributions
        const explanations = [];
        const riskFactors = [];

        for (const tr of ruleResult.triggered_rules) {
            explanations.push(...tr.reasons);
            riskFactors.push({ category: tr.category, detail: tr.rule_name, weight: tr.score });
        }
        for (const factor of xgbResult.factors) {
            if (!explanations.includes(factor)) explanations.push(factor);
        }
        for (const factor of graphResult.factors) {
            if (!explanations.includes(factor)) explanations.push(factor);
        }
        for (const factor of deviceResult.factors) {
            if (!explanations.includes(factor)) explanations.push(factor);
        }
        for (const factor of kycResult.factors) {
            if (!explanations.includes(factor)) explanations.push(factor);
        }

        return new RiskScore({
            score: finalScore,
            risk_tier: riskTier,
            component_scores: {
                rules: ruleResult.score,
                ml_tabular: xgbResult.score,
                autoencoder: aeResult.score,
                statistical: statResult.score,
                graph: graphResult.score,
                identity: combinedIdentityScore
            },
            triggered_rules: ruleResult.triggered_rules,
            risk_factors: riskFactors,
            explanations,
            evaluated_at: new Date().toISOString(),
            metadata: {
                rule_count: ruleResult.count,
                raw_logit: xgbResult.raw_logit,
                reconstruction_error: aeResult.reconstruction_error
            }
        });
    }
}

module.exports = EnsembleRiskEngine;
