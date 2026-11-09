const pool = require("../config/db");

// Fetch accounts belonging to the logged-in user
exports.getAccounts = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT
                id,
                account_number,
                account_holder,
                balance,
                created_at
             FROM accounts
             WHERE user_id = $1
             ORDER BY id ASC`,
            [userId]
        );

        return res.status(200).json({
            message: "Accounts fetched successfully",
            totalAccounts: result.rows.length,
            accounts: result.rows
        });

    } catch (error) {
        console.error("Fetch accounts error:", error.message);

        return res.status(500).json({
            message: "Unable to fetch accounts"
        });
    }
};