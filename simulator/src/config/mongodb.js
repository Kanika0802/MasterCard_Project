const { MongoClient } = require("mongodb");
const config = require("./env");

const client = new MongoClient(config.mongodb.uri);

let database;

async function connectMongoDB() {
    await client.connect();

    database = client.db(config.mongodb.database);

    console.log("MongoDB connected:", config.mongodb.database);

    return database;
}

function getDatabase() {
    if (!database) {
        throw new Error("MongoDB has not been connected yet.");
    }

    return database;
}

module.exports = {
    connectMongoDB,
    getDatabase,
    client
};