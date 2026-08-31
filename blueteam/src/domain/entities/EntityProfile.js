// blueteam/src/domain/entities/EntityProfile.js
"use strict";

class EntityProfile {
    constructor({
        entity_id,
        entity_type,
        created_at = new Date().toISOString(),
        updated_at = new Date().toISOString(),
        transaction_history = [],
        auth_history = [],
        known_devices = new Set(),
        known_ips = new Set(),
        known_locations = [],
        known_beneficiaries = new Set(),
        metrics = {
            total_transactions: 0,
            total_amount: 0,
            avg_amount: 0,
            max_amount: 0,
            std_dev_amount: 0,
            total_failed_logins: 0,
            consecutive_failed_logins: 0,
            last_failed_login_at: null,
            last_login_at: null,
            last_transaction_at: null,
            kyc_status: "VERIFIED",
            account_status: "ACTIVE"
        }
    } = {}) {
        this.entity_id = entity_id;
        this.entity_type = entity_type;
        this.created_at = created_at;
        this.updated_at = updated_at;
        this.transaction_history = transaction_history;
        this.auth_history = auth_history;
        this.known_devices = known_devices instanceof Set ? known_devices : new Set(known_devices || []);
        this.known_ips = known_ips instanceof Set ? known_ips : new Set(known_ips || []);
        this.known_locations = Array.isArray(known_locations) ? known_locations : [];
        this.known_beneficiaries = known_beneficiaries instanceof Set ? known_beneficiaries : new Set(known_beneficiaries || []);
        this.metrics = { ...metrics };
    }

    recordTransaction(tx) {
        const amount = Number(tx.amount || 0);
        const timestamp = tx.timestamp || tx.occurred_at || new Date().toISOString();

        this.transaction_history.push({
            transaction_id: tx.transaction_id,
            amount,
            receiver_account_id: tx.receiver_account_id,
            device_id: tx.device_id,
            channel: tx.channel,
            timestamp,
            location: tx.location
        });

        // Keep last 100 transactions for sliding memory efficiency
        if (this.transaction_history.length > 100) {
            this.transaction_history.shift();
        }

        if (tx.device_id) this.known_devices.add(tx.device_id);
        if (tx.ip_address) this.known_ips.add(tx.ip_address);
        if (tx.receiver_account_id) this.known_beneficiaries.add(tx.receiver_account_id);
        if (tx.location && typeof tx.location === "object") {
            this.known_locations.push({ ...tx.location, timestamp });
            if (this.known_locations.length > 50) this.known_locations.shift();
        }

        // Update running metrics
        const n = this.metrics.total_transactions + 1;
        const total = this.metrics.total_amount + amount;
        const avg = total / n;
        const max = Math.max(this.metrics.max_amount, amount);

        // Incremental variance
        const oldAvg = this.metrics.avg_amount;
        const variance = ((n - 1) * Math.pow(this.metrics.std_dev_amount, 2) + (amount - oldAvg) * (amount - avg)) / n;

        this.metrics.total_transactions = n;
        this.metrics.total_amount = total;
        this.metrics.avg_amount = avg;
        this.metrics.max_amount = max;
        this.metrics.std_dev_amount = Math.sqrt(Math.max(0, variance));
        this.metrics.last_transaction_at = timestamp;
        this.updated_at = new Date().toISOString();
    }

    recordAuthEvent(auth) {
        const eventType = auth.event_type;
        const timestamp = auth.timestamp || new Date().toISOString();

        this.auth_history.push({
            event_id: auth.event_id,
            event_type: eventType,
            device_id: auth.device_id,
            ip_address: auth.ip_address || auth.metadata?.ip_address,
            timestamp
        });

        if (this.auth_history.length > 100) {
            this.auth_history.shift();
        }

        if (auth.device_id) this.known_devices.add(auth.device_id);
        if (auth.ip_address) this.known_ips.add(auth.ip_address);

        if (eventType === "AUTH_LOGIN_FAILED" || eventType === "AUTH_OTP_FAILED") {
            this.metrics.total_failed_logins += 1;
            this.metrics.consecutive_failed_logins += 1;
            this.metrics.last_failed_login_at = timestamp;
        } else if (eventType === "AUTH_LOGIN_SUCCESS" || eventType === "AUTH_OTP_VERIFIED") {
            this.metrics.consecutive_failed_logins = 0;
            this.metrics.last_login_at = timestamp;
        }

        this.updated_at = new Date().toISOString();
    }

    toJSON() {
        return {
            entity_id: this.entity_id,
            entity_type: this.entity_type,
            created_at: this.created_at,
            updated_at: this.updated_at,
            known_devices: Array.from(this.known_devices),
            known_ips: Array.from(this.known_ips),
            known_locations: this.known_locations,
            known_beneficiaries: Array.from(this.known_beneficiaries),
            metrics: this.metrics,
            recent_transactions_count: this.transaction_history.length,
            recent_auth_count: this.auth_history.length
        };
    }
}

module.exports = EntityProfile;
