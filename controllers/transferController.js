
const { transferMoney } = require("../services/transferService");

exports.createTransfer = async (req, res) => {
    try {
        // Validate request body.
        if (
            !req.body ||
            typeof req.body !== "object" ||
            Array.isArray(req.body)
        ) {
            return res.status(400).json({
                message: "Invalid request body"
            });
        }

        const { fromAccountId, toAccountId, amount } = req.body;

        // Validate required fields.
        if (
            fromAccountId === undefined ||
            fromAccountId === null ||
            fromAccountId === "" ||
            toAccountId === undefined ||
            toAccountId === null ||
            toAccountId === "" ||
            amount === undefined ||
            amount === null ||
            amount === ""
        ) {
            return res.status(400).json({
                message: "Source account, destination account and amount are required"
            });
        }

        // Validate amount type.
        if (
            typeof amount !== "string" &&
            typeof amount !== "number"
        ) {
            return res.status(400).json({
                message: "Invalid transfer amount"
            });
        }

        const amountString = String(amount).trim();

        // Validate amount format.
        if (!/^\d+(\.\d{1,2})?$/.test(amountString)) {
            return res.status(400).json({
                message: "Invalid transfer amount"
            });
        }

        // Validate idempotency key.
        const idempotencyKey = req.get("Idempotency-Key");

        if (
            typeof idempotencyKey !== "string" ||
            idempotencyKey.trim().length < 8 ||
            idempotencyKey.trim().length > 255
        ) {
            return res.status(400).json({
                message: "A valid Idempotency-Key header is required"
            });
        }

        // Execute authenticated money transfer.
        const result = await transferMoney({
            userId: req.user.id,
            fromAccountId,
            toAccountId,
            amount: amountString,
            idempotencyKey: idempotencyKey.trim()
        });

        return res.status(200).json(result);

    } catch (error) {
        console.error("Transfer error:", error.message);

        // Map known service errors to HTTP status codes.
        const statusCodes = {
            "Invalid account ID": 400,
            "Cannot transfer to the same account": 400,
            "Invalid transfer amount": 400,
            "A valid idempotency key is required": 400,

            "Idempotency key was already used for another request": 409,
            "Idempotency key has already been used": 409,
            "This idempotency key has already been processed": 409,

            "One or both accounts were not found": 404,
            "Destination account not found": 404,

            "You do not own the source account": 403,

            "Insufficient account balance": 400
        };

        const statusCode = statusCodes[error.message] || 500;

        return res.status(statusCode).json({
            message:
                statusCode === 500
                    ? "Transfer failed due to a server error"
                    : error.message
        });
    }
};
