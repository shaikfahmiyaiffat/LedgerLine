
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

// Write an audit record without interrupting the main operation.
const writeAuditLog = async (userId, action, details) => {
    try {
        await pool.query(
            `INSERT INTO audit_logs (user_id, action, details)
             VALUES ($1, $2, $3::jsonb)`,
            [userId, action, JSON.stringify(details)]
        );
    } catch (error) {
        console.error("Audit logging error:", error.message);
    }
};

// User Registration
exports.register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                message: "Password must contain at least 8 characters"
            });
        }

        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, password)
             VALUES ($1, $2, $3)
             RETURNING id, name, email, role`,
            [name, email, hashedPassword]
        );

        const newUser = result.rows[0];

        // Record successful registration.
        await writeAuditLog(
            newUser.id,
            "USER_REGISTERED",
            {
                email: newUser.email,
                name: newUser.name,
                action: "User registered successfully"
            }
        );

        return res.status(201).json({
            message: "Registration successful",
            user: newUser
        });

    } catch (error) {
        console.error("Registration error:", error.message);

        return res.status(500).json({
            message: "Registration failed"
        });
    }
};

// User Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        if (result.rows.length === 0) {
            // No user ID exists for an unknown email.
            // Avoid inserting a record with a potentially invalid user_id.
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            // Record failed login for an existing user.
            await writeAuditLog(
                user.id,
                "LOGIN_FAILED",
                {
                    email: user.email,
                    reason: "Incorrect password"
                }
            );

            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "1h" }
        );

        // Record successful login.
        await writeAuditLog(
            user.id,
            "USER_LOGIN",
            {
                email: user.email,
                action: "User logged in successfully"
            }
        );

        return res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            message: "Login failed"
        });
    }
};

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name, email, role
             FROM users
             WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.json({
            message: "Profile fetched successfully",
            user: result.rows[0]
        });

    } catch (error) {
        console.error("Profile error:", error.message);

        return res.status(500).json({
            message: "Unable to fetch profile"
        });
    }
};
