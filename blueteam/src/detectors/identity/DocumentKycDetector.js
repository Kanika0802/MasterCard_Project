// blueteam/src/detectors/identity/DocumentKycDetector.js
"use strict";

class DocumentKycDetector {
    constructor() {
        this.modelName = "DOCUMENT_KYC_DETECTOR";
    }

    evaluate(features, event) {
        let score = 0.0;
        const reasons = [];

        if (features.is_kyc_tampered) {
            score += 0.85;
            reasons.push("KYC document verification failed or flagged for synthetic tampering");
        } else if (!features.is_kyc_verified) {
            score += 0.30;
            reasons.push("Incomplete or unverified KYC profile");
        }

        const payload = event?.payload || {};
        if (payload.verification_status === "REJECTED" || payload.liveness_status === "FAILED") {
            score += 0.60;
            reasons.push("Biometric liveness / facial verification failure detected");
        }

        const clampedScore = Math.min(1.0, Math.max(0.0, Number(score.toFixed(4))));

        return {
            model: this.modelName,
            score: clampedScore,
            is_identity_risk: clampedScore >= 0.5,
            factors: reasons
        };
    }
}

module.exports = DocumentKycDetector;
