
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const pool = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const transferRoutes = require("./routes/transferRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const accountRoutes = require("./routes/accountRoutes");
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: [
    "http://localhost:5173",
    "http://localhost:5175",
    "https://ledgerline-frontend-five.vercel.app"
],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Idempotency-Key"
    ],
    optionsSuccessStatus: 204
}));

// Parse JSON requests
app.use(express.json());

// Welcome route
app.get("/", (req, res) => {
    res.json({
        message: "Welcome to LedgerLine API",
        status: "Running"
    });
});

// Database health check
app.get("/api/health", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            status: "Success",
            message: "PostgreSQL connected successfully",
            time: result.rows[0].now
        });
    } catch (error) {
        console.error("Database error:", error.message);

        res.status(500).json({
            status: "Error",
            message: "Database connection failed"
        });
    }
});

// Authentication routes
app.use("/api/auth", authRoutes);

// Money transfer routes
app.use("/api/transfers", transferRoutes);

// Transaction history routes
app.use("/api/transactions", transactionRoutes);

// Account management routes
app.use("/api/accounts", accountRoutes);

// Unknown routes
app.use((req, res) => {
    res.status(404).json({
        message: "API route not found"
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Server error:", err.message);

    res.status(500).json({
        message: "Internal server error"
    });
});

// Start server
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`LedgerLine server running on port ${PORT}`);
});
