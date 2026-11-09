const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const { getAccounts } = require("../controllers/accountController");

// Get accounts of the authenticated user
router.get("/", authMiddleware, getAccounts);

module.exports = router;