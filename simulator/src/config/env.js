require("dotenv").config();

function required(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

module.exports = {
    port: Number(process.env.PORT || 3000),
    nodeEnv: process.env.NODE_ENV || "development",

    postgres: {
        host: required("POSTGRES_HOST"),
        port: Number(process.env.POSTGRES_PORT || 5432),
        database: required("POSTGRES_DB"),
        user: required("POSTGRES_USER"),
        password: required("POSTGRES_PASSWORD")
    },

    mongodb: {
        uri: required("MONGODB_URI"),
        database: required("MONGODB_DB")
    },

    kafka: {
        brokers: required("KAFKA_BROKERS").split(","),
        clientId: required("KAFKA_CLIENT_ID")
    }
};