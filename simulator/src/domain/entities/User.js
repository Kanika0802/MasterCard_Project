// simulator/src/domain/entities/User.js

const { ValidationError } = require("../errors");
const { UserProfileStatus } = require("../constants");

class User {
    constructor({
        user_id,
        first_name,
        last_name,
        email,
        phone,
        date_of_birth,
        address = {},
        occupation = null,
        profile_status = UserProfileStatus.ACTIVE,
        created_at = new Date(),
        updated_at = new Date()
    }) {
        this.user_id = user_id;
        this.first_name = first_name;
        this.last_name = last_name;
        this.email = email;
        this.phone = phone;
        this.date_of_birth = date_of_birth;
        this.address = address;
        this.occupation = occupation;
        this.profile_status = profile_status;
        this.created_at = created_at instanceof Date ? created_at.toISOString() : created_at;
        this.updated_at = updated_at instanceof Date ? updated_at.toISOString() : updated_at;

        this.validate();
    }

    validate() {
        if (!this.user_id) throw new ValidationError("User user_id is required.");
        if (!this.first_name || !this.last_name) throw new ValidationError("First name and last name are required.");
        if (!this.email || !this.email.includes("@")) throw new ValidationError("A valid synthetic email is required.");
        if (!this.phone) throw new ValidationError("Phone number is required.");
        if (!Object.values(UserProfileStatus).includes(this.profile_status)) {
            throw new ValidationError(`Invalid profile status: ${this.profile_status}`);
        }
    }

    deactivate() {
        this.profile_status = UserProfileStatus.DEACTIVATED;
        this.updated_at = new Date().toISOString();
    }

    toJSON() {
        return {
            _id: this.user_id,
            user_id: this.user_id,
            first_name: this.first_name,
            last_name: this.last_name,
            email: this.email,
            phone: this.phone,
            date_of_birth: this.date_of_birth,
            address: this.address,
            occupation: this.occupation,
            profile_status: this.profile_status,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = User;
