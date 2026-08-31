// blueteam/src/features/FeatureExtractor.js
"use strict";

const Aggregators = require("./Aggregators");

class FeatureExtractor {
    constructor(featureStore) {
        this.featureStore = featureStore;
    }

    extractTransactionFeatures(tx, eventOccurredAt = new Date()) {
        const refTime = new Date(eventOccurredAt);
        const amount = Number(tx.amount || 0);
        const userId = tx.initiator_user_id || tx.user_id;
        const senderAccountId = tx.sender_account_id;
        const receiverAccountId = tx.receiver_account_id;
        const deviceId = tx.device_id;
        const location = tx.location || {};

        const userProfile = this.featureStore.getUserProfile(userId);
        const accountProfile = this.featureStore.getAccountProfile(senderAccountId);
        const deviceProfile = this.featureStore.getDeviceProfile(deviceId);
        const kycProfile = this.featureStore.getKycProfile(userId);

        // 1. Velocity features
        const txHistory = userProfile ? userProfile.transaction_history : [];
        const v1m = Aggregators.computeVelocity(txHistory, 60 * 1000, refTime);
        const v5m = Aggregators.computeVelocity(txHistory, 5 * 60 * 1000, refTime);
        const v1h = Aggregators.computeVelocity(txHistory, 60 * 60 * 1000, refTime);
        const v24h = Aggregators.computeVelocity(txHistory, 24 * 60 * 60 * 1000, refTime);

        // 2. Auth & credential features
        const authHistory = userProfile ? userProfile.auth_history : [];
        const failedAuth5m = Aggregators.computeFailedAuthCount(authHistory, 5 * 60 * 1000, refTime);
        const consecutiveFailedLogins = userProfile ? userProfile.metrics.consecutive_failed_logins : 0;

        // 3. Behavioral deviation features
        const userAvg = userProfile?.metrics.avg_amount || 0;
        const userStd = userProfile?.metrics.std_dev_amount || 1;
        const amountZScore = userProfile && userProfile.metrics.total_transactions > 2
            ? (amount - userAvg) / (userStd || 1)
            : 0;
        const amountToAvgRatio = userAvg > 0 ? (amount / userAvg) : 1;

        // 4. Device features
        const isKnownDevice = Boolean(userProfile && deviceId && userProfile.known_devices.has(deviceId));
        const isNewDevice = Boolean(deviceId && !isKnownDevice);
        let deviceAgeHours = 999;
        if (deviceProfile?.registeredAt) {
            deviceAgeHours = (refTime.getTime() - new Date(deviceProfile.registeredAt).getTime()) / (1000 * 60 * 60);
        }

        // 5. Geolocation / Impossible travel features
        let maxGeoSpeedKmH = 0;
        if (userProfile && location.latitude && location.longitude) {
            const recentLocations = userProfile.known_locations;
            if (recentLocations.length > 0) {
                const lastLoc = recentLocations[recentLocations.length - 1];
                maxGeoSpeedKmH = Aggregators.calculateGeoVelocityKmH(lastLoc, lastLoc.timestamp, location, refTime);
            }
        }

        // 6. Beneficiary & graph features
        const isKnownBeneficiary = Boolean(userProfile && receiverAccountId && userProfile.known_beneficiaries.has(receiverAccountId));
        const graphFeatures = this.featureStore.graphExtractor.extractFeatures(senderAccountId, receiverAccountId);

        // 7. KYC & Identity features
        const isKycVerified = (kycProfile?.status === "VERIFIED") || (userProfile?.metrics.kyc_status === "VERIFIED");
        const isKycTampered = (kycProfile?.isTampered === true) || (kycProfile?.status === "REJECTED");

        return {
            amount,
            channel: tx.channel || "WEB_PORTAL",
            transaction_type: tx.transaction_type || "P2P_TRANSFER",
            velocity_count_1m: v1m.count,
            velocity_sum_1m: v1m.sum,
            velocity_count_5m: v5m.count,
            velocity_sum_5m: v5m.sum,
            velocity_count_1h: v1h.count,
            velocity_sum_1h: v1h.sum,
            velocity_count_24h: v24h.count,
            velocity_sum_24h: v24h.sum,
            failed_auth_count_5m: failedAuth5m,
            consecutive_failed_logins: consecutiveFailedLogins,
            amount_z_score: Number(amountZScore.toFixed(4)),
            amount_to_avg_ratio: Number(amountToAvgRatio.toFixed(4)),
            is_new_device: isNewDevice,
            is_known_device: isKnownDevice,
            device_age_hours: Number(deviceAgeHours.toFixed(2)),
            geo_speed_kmh: maxGeoSpeedKmH,
            is_known_beneficiary: isKnownBeneficiary,
            in_degree: graphFeatures.in_degree,
            out_degree: graphFeatures.out_degree,
            pass_through_ratio: graphFeatures.pass_through_ratio,
            fan_in_fan_out_ratio: graphFeatures.fan_in_fan_out_ratio,
            cycle_detected: graphFeatures.cycle_detected,
            min_distance_to_mule: graphFeatures.min_distance_to_mule,
            is_kyc_verified: isKycVerified,
            is_kyc_tampered: isKycTampered
        };
    }
}

module.exports = FeatureExtractor;
