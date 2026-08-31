// attack-primitives/src/definitions/catalog.js
"use strict";

const AUTH_PRIMITIVES = require("./authentication");
const IDENTITY_KYC_PRIMITIVES = require("./identity_kyc");
const DEVICE_PRIMITIVES = require("./device");
const TRANSACTION_PRIMITIVES = require("./transaction");
const MULE_NETWORK_PRIMITIVES = require("./mule_network");
const ACCOUNT_PRIMITIVES = require("./account");

const ALL_CANONICAL_PRIMITIVES = Object.freeze([
    ...AUTH_PRIMITIVES,
    ...IDENTITY_KYC_PRIMITIVES,
    ...DEVICE_PRIMITIVES,
    ...TRANSACTION_PRIMITIVES,
    ...MULE_NETWORK_PRIMITIVES,
    ...ACCOUNT_PRIMITIVES
]);

module.exports = ALL_CANONICAL_PRIMITIVES;
