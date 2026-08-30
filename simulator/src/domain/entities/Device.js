// simulator/src/domain/entities/Device.js

const { ValidationError } = require("../errors");
const { DeviceStatus } = require("../constants");

class Device {
    constructor({
        device_id,
        user_id,
        device_type = "MOBILE",
        operating_system = "SYNTHETIC_OS",
        browser = "SYNTHETIC_BROWSER",
        ip_address = "192.0.2.1",
        geo_location = { country: "US", city: "New York" },
        device_fingerprint,
        status = DeviceStatus.ACTIVE,
        first_seen = new Date(),
        last_seen = new Date()
    }) {
        this.device_id = device_id;
        this.user_id = user_id;
        this.device_type = device_type;
        this.operating_system = operating_system;
        this.browser = browser;
        this.ip_address = ip_address;
        this.geo_location = geo_location;
        this.device_fingerprint = device_fingerprint || `fp_${device_id}`;
        this.status = status;
        this.first_seen = first_seen instanceof Date ? first_seen.toISOString() : first_seen;
        this.last_seen = last_seen instanceof Date ? last_seen.toISOString() : last_seen;

        this.validate();
    }

    validate() {
        if (!this.device_id) throw new ValidationError("device_id is required.");
        if (!this.user_id) throw new ValidationError("user_id is required.");
        if (!Object.values(DeviceStatus).includes(this.status)) {
            throw new ValidationError(`Invalid device status: ${this.status}`);
        }
    }

    retire() {
        this.status = DeviceStatus.RETIRED;
        this.last_seen = new Date().toISOString();
    }

    updateSeen() {
        this.last_seen = new Date().toISOString();
    }

    toJSON() {
        return {
            _id: this.device_id,
            device_id: this.device_id,
            user_id: this.user_id,
            device_type: this.device_type,
            operating_system: this.operating_system,
            browser: this.browser,
            ip_address: this.ip_address,
            geo_location: this.geo_location,
            device_fingerprint: this.device_fingerprint,
            status: this.status,
            first_seen: this.first_seen,
            last_seen: this.last_seen
        };
    }
}

module.exports = Device;
