
const pool = require("../config/db");

// Get transaction history for the logged-in user
exports.getTransactionHistory = async (req, res) => {
    try {
        const userId = Number(req.user.id);

        // Validate logged-in user
        if (!Number.isSafeInteger(userId) || userId <= 0) {
            return res.status(401).json({
                message: "Invalid user authentication"
            });
        }

        // Pagination validation
        const requestedPage = Number.parseInt(req.query.page, 10);
        const requestedLimit = Number.parseInt(req.query.limit, 10);

        const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
            ? requestedPage
            : 1;

        const limit = Number.isSafeInteger(requestedLimit) &&
            requestedLimit > 0
            ? Math.min(requestedLimit, 100)
            : 10;

        const offset = (page - 1) * limit;

        // Fetch transactions involving the user's accounts
        const result = await pool.query(
            `SELECT
                t.id,
                t.from_account_id,
                sender.account_number AS from_account_number,
                sender.account_holder AS from_account_holder,
                t.to_account_id,
                receiver.account_number AS to_account_number,
                receiver.account_holder AS to_account_holder,
                t.amount,
                t.status,
                t.created_at
             FROM transactions t
             JOIN accounts sender
                ON sender.id = t.from_account_id
             JOIN accounts receiver
                ON receiver.id = t.to_account_id
             WHERE
                sender.user_id = $1
                OR receiver.user_id = $1
             ORDER BY t.created_at DESC, t.id DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        // Count total transactions
        const countResult = await pool.query(
            `SELECT COUNT(*) AS total
             FROM transactions t
             JOIN accounts sender
                ON sender.id = t.from_account_id
             JOIN accounts receiver
                ON receiver.id = t.to_account_id
             WHERE
                sender.user_id = $1
                OR receiver.user_id = $1`,
            [userId]
        );

        const total = Number(countResult.rows[0].total);

        return res.status(200).json({
            message: "Transaction history fetched successfully",

            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },

            transactions: result.rows
        });

    } catch (error) {
        console.error(
            "Transaction history error:",
            error.message
        );

        return res.status(500).json({
            message: "Unable to fetch transaction history"
        });
    }
};
