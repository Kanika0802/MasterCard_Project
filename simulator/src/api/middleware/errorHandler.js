// simulator/src/api/middleware/errorHandler.js

const { DomainError } = require("../../domain/errors");

function errorHandler(err, req, res, next) {
    if (err instanceof DomainError) {
        return res.status(err.statusCode).json({
            error: {
                code: err.errorCode,
                message: err.message,
                details: err.details || null
            }
        });
    }

    console.error("[InternalError]", err);

    return res.status(500).json({
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred."
        }
    });
}

module.exports = errorHandler;
