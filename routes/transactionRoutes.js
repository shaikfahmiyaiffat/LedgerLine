
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const {
    getTransactionHistory
} = require("../controllers/transactionController");

// Get transaction history for logged-in user
router.get("/", authMiddleware, getTransactionHistory);

module.exports = router;
