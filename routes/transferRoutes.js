const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const { createTransfer } = require("../controllers/transferController");
const {
    getTransactionHistory
} = require("../controllers/transactionController");

// Create a money transfer.
router.post("/", authMiddleware, createTransfer);

// Get transaction history.
router.get("/", authMiddleware, getTransactionHistory);

module.exports = router;