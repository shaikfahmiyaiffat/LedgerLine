
const pool = require("../config/db");

// Convert a valid money amount into cents for exact comparison.
const toCents = (value) => {
    const amount = String(value);

    if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
        throw new Error("Invalid transfer amount");
    }

    const [whole, decimal = ""] = amount.split(".");
    return BigInt(whole) * 100n +
        BigInt((decimal + "00").slice(0, 2));
};

// Transfer money safely between two accounts.
exports.transferMoney = async ({
    userId,
    fromAccountId,
    toAccountId,
    amount,
    idempotencyKey
}) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
        // Validate user and account IDs.
        const senderId = Number(fromAccountId);
        const receiverId = Number(toAccountId);
        const ownerId = Number(userId);

        if (
            !Number.isSafeInteger(senderId) || senderId <= 0 ||
            !Number.isSafeInteger(receiverId) || receiverId <= 0 ||
            !Number.isSafeInteger(ownerId) || ownerId <= 0
        ) {
            throw new Error("Invalid account ID");
        }

        if (senderId === receiverId) {
            throw new Error("Cannot transfer to the same account");
        }

        // Validate transfer amount.
        if (
            typeof amount !== "string" ||
            !/^\d+(\.\d{1,2})?$/.test(amount) ||
            toCents(amount) <= 0n
        ) {
            throw new Error("Invalid transfer amount");
        }

        // Validate idempotency key.
        if (
            typeof idempotencyKey !== "string" ||
            idempotencyKey.trim().length < 8 ||
            idempotencyKey.length > 255
        ) {
            throw new Error("A valid idempotency key is required");
        }

        await client.query("BEGIN");
        transactionStarted = true;

        // Check whether this request was already processed.
        const existing = await client.query(
            `SELECT t.*
             FROM transactions t
             JOIN accounts a
                ON a.id = t.from_account_id
             WHERE t.idempotency_key = $1
               AND a.user_id = $2`,
            [idempotencyKey, ownerId]
        );

        if (existing.rows.length > 0) {
            const previous = existing.rows[0];

            if (
                Number(previous.from_account_id) !== senderId ||
                Number(previous.to_account_id) !== receiverId ||
                toCents(previous.amount) !== toCents(amount)
            ) {
                throw new Error(
                    "Idempotency key was already used for another request"
                );
            }

            await client.query("COMMIT");
            transactionStarted = false;

            return {
                message: "Request already processed",
                transaction: previous,
                duplicate: true
            };
        }

        // Lock both accounts in a consistent order.
        const accounts = await client.query(
            `SELECT id, user_id, balance
             FROM accounts
             WHERE id = ANY($1::integer[])
             ORDER BY id
             FOR UPDATE`,
            [[senderId, receiverId]]
        );

        if (accounts.rows.length !== 2) {
            throw new Error("One or both accounts were not found");
        }

        const source = accounts.rows.find(
            account => Number(account.id) === senderId
        );

        // Verify source account ownership.
        if (Number(source.user_id) !== ownerId) {
            throw new Error("You do not own the source account");
        }

        // Create transaction record.
        const transactionResult = await client.query(
            `INSERT INTO transactions
             (idempotency_key, from_account_id, to_account_id, amount, status)
             VALUES ($1, $2, $3, $4, 'PENDING')
             ON CONFLICT (idempotency_key) DO NOTHING
             RETURNING *`,
            [idempotencyKey, senderId, receiverId, amount]
        );

        // Handle simultaneous requests with the same key.
        if (transactionResult.rows.length === 0) {
            const previousResult = await client.query(
                `SELECT t.*
                 FROM transactions t
                 JOIN accounts a
                    ON a.id = t.from_account_id
                 WHERE t.idempotency_key = $1
                   AND a.user_id = $2`,
                [idempotencyKey, ownerId]
            );

            if (previousResult.rows.length === 0) {
                throw new Error(
                    "Idempotency key has already been used"
                );
            }

            const previous = previousResult.rows[0];

            if (
                Number(previous.from_account_id) !== senderId ||
                Number(previous.to_account_id) !== receiverId ||
                toCents(previous.amount) !== toCents(amount)
            ) {
                throw new Error(
                    "Idempotency key was already used for another request"
                );
            }

            await client.query("COMMIT");
            transactionStarted = false;

            return {
                message: "Request already processed",
                transaction: previous,
                duplicate: true
            };
        }

        const transactionId = transactionResult.rows[0].id;

        // Debit source account only when sufficient balance exists.
        const debit = await client.query(
            `UPDATE accounts
             SET balance = balance - $1::numeric
             WHERE id = $2
               AND balance >= $1::numeric
             RETURNING id`,
            [amount, senderId]
        );

        if (debit.rows.length === 0) {
            throw new Error("Insufficient account balance");
        }

        // Credit destination account.
        const credit = await client.query(
            `UPDATE accounts
             SET balance = balance + $1::numeric
             WHERE id = $2
             RETURNING id`,
            [amount, receiverId]
        );

        if (credit.rows.length === 0) {
            throw new Error("Destination account not found");
        }

        // Record debit entry.
        await client.query(
            `INSERT INTO ledger_entries
             (transaction_id, account_id, entry_type, amount)
             VALUES ($1, $2, 'DEBIT', $3)`,
            [transactionId, senderId, amount]
        );

        // Record credit entry.
        await client.query(
            `INSERT INTO ledger_entries
             (transaction_id, account_id, entry_type, amount)
             VALUES ($1, $2, 'CREDIT', $3)`,
            [transactionId, receiverId, amount]
        );

        // Mark transaction as completed.
        const completed = await client.query(
            `UPDATE transactions
             SET status = 'COMPLETED'
             WHERE id = $1
             RETURNING *`,
            [transactionId]
        );

        // Record successful transfer in the audit log.
        // This is part of the same database transaction.
        await client.query(
            `INSERT INTO audit_logs
             (user_id, action, details)
             VALUES ($1, $2, $3::jsonb)`,
            [
                ownerId,
                "TRANSFER_COMPLETED",
                JSON.stringify({
                    transactionId,
                    fromAccountId: senderId,
                    toAccountId: receiverId,
                    amount,
                    status: "COMPLETED"
                })
            ]
        );

        // Commit transfer, ledger entries and audit log together.
        await client.query("COMMIT");
        transactionStarted = false;

        return {
            message: "Money transferred successfully",
            transaction: completed.rows[0],
            duplicate: false
        };

    } catch (error) {
        // Roll back everything if any operation fails.
        if (transactionStarted) {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError.message);
            }
        }

        throw error;

    } finally {
        client.release();
    }
};
