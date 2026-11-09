
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    try {
        // Check whether the JWT secret is configured.
        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is missing from environment variables");

            return res.status(500).json({
                message: "Authentication configuration error"
            });
        }

        // Read authorization header.
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Access denied. Token required."
            });
        }

        // Extract token.
        const token = authHeader.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                message: "Access denied. Invalid token."
            });
        }

        // Verify token signature and expiration.
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            { algorithms: ["HS256"] }
        );

        // Validate decoded user information.
        if (
            !decoded ||
            !Number.isSafeInteger(Number(decoded.id)) ||
            Number(decoded.id) <= 0 ||
            typeof decoded.email !== "string"
        ) {
            return res.status(401).json({
                message: "Invalid authentication token"
            });
        }

        // Attach authenticated user to request.
        req.user = {
            id: Number(decoded.id),
            email: decoded.email,
            role: decoded.role
        };

        next();

    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Session expired. Please log in again."
            });
        }

        return res.status(401).json({
            message: "Invalid authentication token"
        });
    }
};

module.exports = authMiddleware;
