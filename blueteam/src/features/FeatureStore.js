// blueteam/src/features/FeatureStore.js
"use strict";

const EntityProfile = require("../domain/entities/EntityProfile");
const GraphFeatureExtractor = require("./GraphFeatureExtractor");

class FeatureStore {
    constructor() {
        this.userProfiles = new Map();     // userId -> EntityProfile
        this.accountProfiles = new Map();  // accountId -> EntityProfile
        this.deviceProfiles = new Map();   // deviceId -> { deviceId, userId, registeredAt, status, failureCount, ... }
        this.kycProfiles = new Map();      // userId -> { kycId, status, liveness, docType, updatedAt }
        this.graphExtractor = new GraphFeatureExtractor();
    }

    getUserProfile(userId) {
        if (!userId) return null;
        if (!this.userProfiles.has(userId)) {
            this.userProfiles.set(userId, new EntityProfile({
                entity_id: userId,
                entity_type: "user"
            }));
        }
        return this.userProfiles.get(userId);
    }

    getAccountProfile(accountId) {
        if (!accountId) return null;
        if (!this.accountProfiles.has(accountId)) {
            this.accountProfiles.set(accountId, new EntityProfile({
                entity_id: accountId,
                entity_type: "account"
            }));
        }
        return this.accountProfiles.get(accountId);
    }

    getDeviceProfile(deviceId) {
        if (!deviceId) return null;
        return this.deviceProfiles.get(deviceId) || null;
    }

    getKycProfile(userId) {
        if (!userId) return null;
        return this.kycProfiles.get(userId) || null;
    }

    setDeviceProfile(deviceId, data) {
        if (!deviceId) return;
        const existing = this.deviceProfiles.get(deviceId) || {};
        this.deviceProfiles.set(deviceId, {
            ...existing,
            ...data,
            deviceId,
            updatedAt: new Date().toISOString()
        });
    }

    setKycProfile(userId, data) {
        if (!userId) return;
        const existing = this.kycProfiles.get(userId) || {};
        this.kycProfiles.set(userId, {
            ...existing,
            ...data,
            userId,
            updatedAt: new Date().toISOString()
        });
    }

    recordTransaction(tx) {
        if (!tx) return;
        const senderAccount = this.getAccountProfile(tx.sender_account_id);
        if (senderAccount) senderAccount.recordTransaction(tx);

        const receiverAccount = this.getAccountProfile(tx.receiver_account_id);
        if (receiverAccount) receiverAccount.recordTransaction(tx);

        const user = this.getUserProfile(tx.initiator_user_id);
        if (user) user.recordTransaction(tx);

        if (tx.sender_account_id && tx.receiver_account_id) {
            this.graphExtractor.recordTransfer({
                fromAccountId: tx.sender_account_id,
                toAccountId: tx.receiver_account_id,
                amount: tx.amount,
                transactionId: tx.transaction_id,
                timestamp: tx.timestamp || tx.occurred_at
            });
        }
    }

    recordAuthEvent(auth) {
        if (!auth) return;
        const user = this.getUserProfile(auth.user_id);
        if (user) user.recordAuthEvent(auth);

        if (auth.device_id) {
            const dev = this.getDeviceProfile(auth.device_id) || { deviceId: auth.device_id };
            if (auth.event_type === "AUTH_LOGIN_FAILED" || auth.event_type === "AUTH_OTP_FAILED") {
                dev.failureCount = (dev.failureCount || 0) + 1;
            }
            this.setDeviceProfile(auth.device_id, dev);
        }
    }

    clear() {
        this.userProfiles.clear();
        this.accountProfiles.clear();
        this.deviceProfiles.clear();
        this.kycProfiles.clear();
        this.graphExtractor.clear();
    }
}

module.exports = FeatureStore;
