
require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
});

pool.on("connect", () => {
    console.log("PostgreSQL connection established!");
});

pool.on("error", (err) => {
    console.error("Database error:", err.message);
});

// Test database connection
pool.query("SELECT NOW()", (err, result) => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("Database connected successfully!");
        console.log("Database time:", result.rows[0].now);
    }
});

module.exports = pool;
