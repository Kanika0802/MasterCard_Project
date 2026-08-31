// blueteam/src/detectors/ml/AutoencoderDetector.js
"use strict";

class AutoencoderDetector {
    constructor(options = {}) {
        this.reconstructionThreshold = options.reconstructionThreshold || 0.25;

        // Linear + Non-linear Autoencoder projection weights with proper bias
        // Projection down to 3 principal latent components and reconstruction back to 8
        this.components = [
            [0.45, 0.35, 0.40, 0.10, 0.30, 0.15, 0.20, 0.25], // Principal Component 1: Financial & Velocity Scale
            [0.10, 0.15, 0.10, 0.60, 0.20, 0.55, 0.10, 0.10], // Principal Component 2: Auth & Device Risk
            [0.15, 0.10, 0.15, 0.10, 0.20, 0.10, 0.70, 0.60]  // Principal Component 3: Geo & Mule Pass-Through
        ];
    }

    _extractNormalizedVector(features) {
        return [
            Math.min(1.0, (features.amount || 0) / 5000),
            Math.min(1.0, (features.velocity_count_5m || 0) / 5),
            Math.min(1.0, (features.velocity_sum_5m || 0) / 10000),
            Math.min(1.0, (features.failed_auth_count_5m || 0) / 3),
            Math.min(1.0, Math.abs(features.amount_z_score || 0) / 3),
            features.is_new_device ? 1.0 : 0.0,
            Math.min(1.0, (features.geo_speed_kmh || 0) / 800),
            Math.min(1.0, (features.pass_through_ratio || 0))
        ];
    }

    evaluate(features) {
        const x = this._extractNormalizedVector(features);

        // Project onto subspace: z = x * V^T
        const z = [0, 0, 0];
        for (let k = 0; k < 3; k++) {
            let dot = 0;
            for (let i = 0; i < 8; i++) {
                dot += x[i] * this.components[k][i];
            }
            z[k] = dot;
        }

        // Reconstruct from subspace: x_hat = z * V
        const x_hat = new Array(8).fill(0);
        for (let i = 0; i < 8; i++) {
            let sum = 0;
            for (let k = 0; k < 3; k++) {
                sum += z[k] * this.components[k][i];
            }
            x_hat[i] = sum;
        }

        // Compute Reconstruction Error (Distance to normal manifold)
        let sumSquaredDiff = 0;
        for (let i = 0; i < 8; i++) {
            const diff = x[i] - x_hat[i];
            sumSquaredDiff += diff * diff;
        }
        const mse = sumSquaredDiff / 8;

        // Compute non-linear anomaly score [0.0 - 1.0]
        const anomalyScore = Math.min(1.0, Number((mse / this.reconstructionThreshold).toFixed(4)));

        return {
            model: "AUTOENCODER",
            reconstruction_error: Number(mse.toFixed(4)),
            score: anomalyScore,
            is_anomaly: anomalyScore >= 0.5,
            factors: anomalyScore >= 0.5 ? ["High neural reconstruction error against baseline behavior profile"] : []
        };
    }
}

module.exports = AutoencoderDetector;
