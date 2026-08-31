// blueteam/src/features/Aggregators.js
"use strict";

class Aggregators {
    /**
     * Compute transaction velocity (count & sum) in a given sliding time window (in ms)
     */
    static computeVelocity(transactions, windowMs, referenceTime = new Date()) {
        const refTimeMs = referenceTime instanceof Date ? referenceTime.getTime() : new Date(referenceTime).getTime();
        const cutoff = refTimeMs - windowMs;

        let count = 0;
        let sum = 0;
        let max = 0;

        for (const tx of transactions) {
            const txTimeMs = new Date(tx.timestamp || tx.occurred_at).getTime();
            if (txTimeMs >= cutoff && txTimeMs <= refTimeMs) {
                count += 1;
                const amt = Number(tx.amount || 0);
                sum += amt;
                if (amt > max) max = amt;
            }
        }

        return { count, sum: Number(sum.toFixed(2)), max };
    }

    /**
     * Compute failed auth attempts in a sliding time window (in ms)
     */
    static computeFailedAuthCount(authHistory, windowMs, referenceTime = new Date()) {
        const refTimeMs = referenceTime instanceof Date ? referenceTime.getTime() : new Date(referenceTime).getTime();
        const cutoff = refTimeMs - windowMs;

        let failedCount = 0;
        for (const auth of authHistory) {
            const authTimeMs = new Date(auth.timestamp).getTime();
            if (authTimeMs >= cutoff && authTimeMs <= refTimeMs) {
                if (auth.event_type === "AUTH_LOGIN_FAILED" || auth.event_type === "AUTH_OTP_FAILED") {
                    failedCount += 1;
                }
            }
        }
        return failedCount;
    }

    /**
     * Haversine formula to compute great circle distance in km between two geo-coordinates
     */
    static haversineDistanceKm(lat1, lon1, lat2, lon2) {
        if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined ||
            lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
            return 0;
        }

        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Number((R * c).toFixed(2));
    }

    /**
     * Calculate geo-velocity (speed in km/h) between two geographical events
     */
    static calculateGeoVelocityKmH(loc1, time1, loc2, time2) {
        if (!loc1 || !loc2 || !loc1.latitude || !loc1.longitude || !loc2.latitude || !loc2.longitude) {
            return 0;
        }

        const t1 = new Date(time1).getTime();
        const t2 = new Date(time2).getTime();
        const diffHours = Math.abs(t2 - t1) / (1000 * 60 * 60);

        if (diffHours <= 0) {
            const dist = Aggregators.haversineDistanceKm(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude);
            return dist > 10 ? 999999 : 0; // Instantaneous displacement
        }

        const distanceKm = Aggregators.haversineDistanceKm(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude);
        return Number((distanceKm / diffHours).toFixed(2));
    }
}

module.exports = Aggregators;
