const { connectMongoDB, client } = require("../../config/mongodb");

async function initMongoDB() {
    console.log("==================================================");
    console.log("          AIPAYSEC MONGODB INITIALIZATION         ");
    console.log("==================================================");

    const db = await connectMongoDB();

    // 1. Users Collection
    console.log("Initializing 'users' collection & indexes...");
    const users = db.collection("users");
    await users.createIndex({ email: 1 }, { unique: true, name: "idx_users_email_unique" });
    await users.createIndex({ phone: 1 }, { name: "idx_users_phone" });
    await users.createIndex({ profile_status: 1 }, { name: "idx_users_profile_status" });
    await users.createIndex({ created_at: -1 }, { name: "idx_users_created_at" });
    console.log("  [SUCCESS] 'users' indexes created.");

    // 2. KYC Records Collection
    console.log("Initializing 'kyc_records' collection & indexes...");
    const kycRecords = db.collection("kyc_records");
    await kycRecords.createIndex({ user_id: 1 }, { name: "idx_kyc_user_id" });
    await kycRecords.createIndex({ verification_status: 1 }, { name: "idx_kyc_verification_status" });
    await kycRecords.createIndex({ document_reference: 1 }, { sparse: true, name: "idx_kyc_doc_ref" });
    console.log("  [SUCCESS] 'kyc_records' indexes created.");

    // 3. Devices Collection
    console.log("Initializing 'devices' collection & indexes...");
    const devices = db.collection("devices");
    await devices.createIndex({ user_id: 1 }, { name: "idx_devices_user_id" });
    await devices.createIndex({ device_fingerprint: 1 }, { name: "idx_devices_fingerprint" });
    await devices.createIndex({ ip_address: 1 }, { name: "idx_devices_ip_address" });
    await devices.createIndex({ status: 1 }, { name: "idx_devices_status" });
    await devices.createIndex({ user_id: 1, status: 1 }, { name: "idx_devices_user_status" });
    console.log("  [SUCCESS] 'devices' indexes created.");

    // 4. Authentication Events Collection (for simulator auth event log)
    console.log("Initializing 'auth_events' collection & indexes...");
    const authEvents = db.collection("auth_events");
    await authEvents.createIndex({ user_id: 1, timestamp: -1 }, { name: "idx_auth_events_user_time" });
    await authEvents.createIndex({ device_id: 1, timestamp: -1 }, { name: "idx_auth_events_device_time" });
    await authEvents.createIndex({ event_type: 1 }, { name: "idx_auth_events_event_type" });
    console.log("  [SUCCESS] 'auth_events' indexes created.");

    console.log("==================================================");
    console.log("MongoDB collections and indexes initialized successfully.");
    console.log("==================================================");
}

if (require.main === module) {
    initMongoDB()
        .then(async () => {
            await client.close();
            process.exit(0);
        })
        .catch(async (err) => {
            console.error("MongoDB init failed:", err);
            await client.close();
            process.exit(1);
        });
}

module.exports = {
    initMongoDB
};
