// blueteam/src/detectors/identity/DeviceFingerprintDetector.js
"use strict";

class DeviceFingerprintDetector {
    constructor() {
        this.modelName = "DEVICE_FINGERPRINT_DETECTOR";
    }

    evaluate(features, event) {
        let score = 0.0;
        const reasons = [];

        if (features.is_new_device) {
            score += 0.35;
            reasons.push("Unrecognized device fingerprint / hardware signature");
        }

        if (features.device_age_hours < 1.0 && (features.amount || 0) > 500) {
            score += 0.40;
            reasons.push("High-value transaction within 1 hour of device enrollment");
        }

        const payload = event?.payload || {};
        if (payload.device_fingerprint && typeof payload.device_fingerprint === "string") {
            // Check for obvious spoofing indicators or empty entropy
            if (payload.device_fingerprint.includes("spoofed") || payload.device_fingerprint.length < 8) {
                score += 0.50;
                reasons.push("Suspicious or low-entropy device fingerprint string");
            }
        }

        const clampedScore = Math.min(1.0, Math.max(0.0, Number(score.toFixed(4))));

        return {
            model: this.modelName,
            score: clampedScore,
            is_device_risk: clampedScore >= 0.5,
            factors: reasons
        };
    }
}

module.exports = DeviceFingerprintDetector;
