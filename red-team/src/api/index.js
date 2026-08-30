// red-team/src/api/index.js

const RedTeamExecutionController = require("./RedTeamExecutionController");
const { createRedTeamRouter } = require("./routes");
const { createRedTeamApp } = require("./app");

module.exports = {
    RedTeamExecutionController,
    createRedTeamRouter,
    createRedTeamApp
};
