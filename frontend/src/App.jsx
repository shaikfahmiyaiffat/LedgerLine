
import { useState, useEffect } from "react";
import "./App.css";

const API_URL = "http://localhost:5001/api";

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("ledgerline_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(
    () => localStorage.getItem("ledgerline_token") || ""
  );

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const [transfer, setTransfer] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: ""
  });

  const [lastTransaction, setLastTransaction] = useState(null);

  // Account management state
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [accountsReload, setAccountsReload] = useState(0);

  // Transaction history state
  const [transactions, setTransactions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [historyReload, setHistoryReload] = useState(0);

  // Preserve the same idempotency key when retrying an identical request
  const [pendingRequest, setPendingRequest] = useState(null);

  const showMessage = (text, type = "error") => {
    setMessage(text);
    setMessageType(type);
  };

  // Handle authentication form changes
  const handleChange = (event) => {
    setForm({
      ...form,
      [event.target.name]: event.target.value
    });
  };

  // Handle transfer form changes
  const handleTransferChange = (event) => {
    setTransfer({
      ...transfer,
      [event.target.name]: event.target.value
    });
  };

  // Register and login
  const handleAuth = async (event) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    const endpoint = isLogin ? "/auth/login" : "/auth/register";

    const body = isLogin
      ? {
          email: form.email.trim(),
          password: form.password
        }
      : {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password
        };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      if (!isLogin) {
        showMessage(
          "Registration successful! Please log in.",
          "success"
        );

        setIsLogin(true);

        setForm({
          name: "",
          email: form.email,
          password: ""
        });
      } else {
        localStorage.setItem("ledgerline_token", data.token);
        localStorage.setItem(
          "ledgerline_user",
          JSON.stringify(data.user)
        );

        setToken(data.token);
        setUser(data.user);

        setForm({
          name: "",
          email: "",
          password: ""
        });

        showMessage("");
      }
    } catch (error) {
      showMessage(error.message || "Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  // Fetch accounts belonging to the logged-in user
  useEffect(() => {
    if (!user || !token) {
      setAccounts([]);
      return;
    }

    const fetchAccounts = async () => {
      setAccountsLoading(true);
      setAccountsError("");

      try {
        const response = await fetch(`${API_URL}/accounts`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to fetch accounts");
        }

        const fetchedAccounts = data.accounts || [];

        setAccounts(fetchedAccounts);

        // Set default accounts using actual database records
        setTransfer((previous) => {
          const firstAccount = fetchedAccounts[0];
          const secondAccount = fetchedAccounts.find(
            (account) => account.id !== firstAccount?.id
          );

          const fromExists = fetchedAccounts.some(
            (account) => String(account.id) === previous.fromAccountId
          );

          const toExists = fetchedAccounts.some(
            (account) => String(account.id) === previous.toAccountId
          );

          const fromId = fromExists
            ? previous.fromAccountId
            : firstAccount
              ? String(firstAccount.id)
              : "";

          let toId = toExists ? previous.toAccountId : "";

          if (!toId || toId === fromId) {
            toId = secondAccount
              ? String(secondAccount.id)
              : "";
          }

          return {
            ...previous,
            fromAccountId: fromId,
            toAccountId: toId
          };
        });
      } catch (error) {
        setAccountsError(error.message);
      } finally {
        setAccountsLoading(false);
      }
    };

    fetchAccounts();
  }, [user, token, accountsReload]);

  // Fetch transaction history
  useEffect(() => {
    if (!user || !token) {
      setTransactions([]);
      return;
    }

    const fetchTransactionHistory = async () => {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const response = await fetch(
          `${API_URL}/transactions?page=${historyPage}&limit=5`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Unable to fetch transaction history"
          );
        }

        setTransactions(data.transactions || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalTransactions(data.pagination?.total || 0);
      } catch (error) {
        setHistoryError(error.message);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchTransactionHistory();
  }, [user, token, historyPage, historyReload]);

  // Transfer money
  const handleTransfer = async (event) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setLastTransaction(null);

    if (!transfer.fromAccountId || !transfer.toAccountId) {
      showMessage("Please select both accounts.");
      setLoading(false);
      return;
    }

    if (transfer.fromAccountId === transfer.toAccountId) {
      showMessage("Choose two different accounts.");
      setLoading(false);
      return;
    }

    const amount = transfer.amount.trim();

    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      showMessage("Enter a valid amount with up to two decimal places.");
      setLoading(false);
      return;
    }

    const requestBody = {
      fromAccountId: Number(transfer.fromAccountId),
      toAccountId: Number(transfer.toAccountId),
      amount
    };

    const requestSignature = JSON.stringify(requestBody);

    let idempotencyKey;

    if (pendingRequest?.signature === requestSignature) {
      idempotencyKey = pendingRequest.key;
    } else {
      idempotencyKey = crypto.randomUUID();

      setPendingRequest({
        signature: requestSignature,
        key: idempotencyKey
      });
    }

    try {
      const response = await fetch(`${API_URL}/transfers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Transfer failed");
      }

      setLastTransaction(data);

      showMessage(
        data.message || "Transfer completed successfully!",
        "success"
      );

      setTransfer((previous) => ({
        ...previous,
        amount: ""
      }));

      setPendingRequest(null);

      // Refresh accounts and transaction history after transfer
      setAccountsReload((previous) => previous + 1);
      setHistoryPage(1);
      setHistoryReload((previous) => previous + 1);
    } catch (error) {
      showMessage(error.message || "Unable to complete transfer");
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("ledgerline_token");
    localStorage.removeItem("ledgerline_user");

    setToken("");
    setUser(null);
    setLastTransaction(null);
    setTransactions([]);
    setAccounts([]);
    setMessage("");
    setHistoryError("");
    setAccountsError("");
    setHistoryPage(1);
    setPendingRequest(null);
    setIsLogin(true);
  };

  // Format amount in Indian currency
  const formatAmount = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2
    }).format(Number(amount));
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "N/A";

    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  };

  // Dashboard
  if (user && token) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <div className="dashboard-brand">
            <div className="brand-logo small-logo">L</div>

            <div>
              <h2>LedgerLine</h2>
              <span>Smart. Secure. Balanced.</span>
            </div>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </header>

        <main className="dashboard-content">
          <section className="welcome-card">
            <div>
              <p className="eyebrow">YOUR FINANCIAL WORKSPACE</p>
              <h1>Welcome, {user.name}!</h1>
              <p>Manage your transfers with confidence.</p>
            </div>

            <div className="welcome-icon">L</div>
          </section>

          <section className="dashboard-grid">
            <div className="info-card">
              <span className="card-icon">↔</span>
              <h3>Money Transfers</h3>
              <p>
                Transfer funds between accounts with secure,
                authenticated requests.
              </p>
            </div>

            <div className="info-card">
              <span className="card-icon">✓</span>
              <h3>Protected Requests</h3>
              <p>
                Transfer requests use idempotency keys to help
                prevent duplicate processing.
              </p>
            </div>
          </section>

          {/* Account balances */}
          <section className="transfer-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR ACCOUNTS</p>
                <h2>Account Overview</h2>
              </div>

              <span className="transfer-symbol">₹</span>
            </div>

            {accountsLoading ? (
              <p>Loading your accounts...</p>
            ) : accountsError ? (
              <div className="message error">{accountsError}</div>
            ) : accounts.length === 0 ? (
              <p>No accounts are linked to your profile.</p>
            ) : (
              <div className="dashboard-grid">
                {accounts.map((account) => (
                  <div className="info-card" key={account.id}>
                    <span className="card-icon">₹</span>
                    <h3>{account.account_number}</h3>
                    <p>{account.account_holder}</p>
                    <h2>{formatAmount(account.balance)}</h2>
                    <p>Account ID: {account.id}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Money transfer section */}
          <section className="transfer-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">PAYMENTS</p>
                <h2>Make a transfer</h2>
              </div>

              <span className="transfer-symbol">⇄</span>
            </div>

            <form onSubmit={handleTransfer}>
              <div className="form-row">
                <div className="form-group">
                  <label>From account</label>

                  <select
                    name="fromAccountId"
                    value={transfer.fromAccountId}
                    onChange={handleTransferChange}
                    disabled={accountsLoading || accounts.length === 0}
                    required
                  >
                    <option value="">Select source account</option>

                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.account_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>To account</label>

                  <select
                    name="toAccountId"
                    value={transfer.toAccountId}
                    onChange={handleTransferChange}
                    disabled={accountsLoading || accounts.length < 2}
                    required
                  >
                    <option value="">Select destination account</option>

                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.account_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Amount</label>

                <div className="amount-field">
                  <span>₹</span>

                  <input
                    type="number"
                    name="amount"
                    placeholder="Enter amount"
                    value={transfer.amount}
                    onChange={handleTransferChange}
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              {message && (
                <div className={`message ${messageType}`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={
                  loading ||
                  accountsLoading ||
                  accounts.length < 2
                }
              >
                {loading ? "Processing..." : "Transfer Money"}
              </button>
            </form>

            {lastTransaction && (
              <div className="transaction-result">
                <h3>Transfer response</h3>

                <pre>
                  {JSON.stringify(lastTransaction, null, 2)}
                </pre>
              </div>
            )}
          </section>

          {/* Transaction history */}
          <section className="transfer-card history-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR ACTIVITY</p>
                <h2>Transaction History</h2>
                <p>Total transactions: {totalTransactions}</p>
              </div>

              <span className="transfer-symbol">↻</span>
            </div>

            {historyLoading ? (
              <p>Loading transaction history...</p>
            ) : historyError ? (
              <div className="message error">{historyError}</div>
            ) : transactions.length === 0 ? (
              <p>No transactions found.</p>
            ) : (
              <>
                <div className="transaction-history-list">
                  {transactions.map((transaction) => (
                    <div
                      className="history-item"
                      key={transaction.id}
                    >
                      <div className="history-item-details">
                        <h3>Transaction #{transaction.id}</h3>

                        <p>
                          From: {transaction.from_account_number ||
                            `Account ${transaction.from_account_id}`}
                        </p>

                        <p>
                          To: {transaction.to_account_number ||
                            `Account ${transaction.to_account_id}`}
                        </p>

                        <p>Date: {formatDate(transaction.created_at)}</p>
                      </div>

                      <div className="history-item-status">
                        <h3>{formatAmount(transaction.amount)}</h3>

                        <span
                          className={`transaction-status ${
                            transaction.status?.toLowerCase() || ""
                          }`}
                        >
                          {transaction.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pagination-controls">
                  <button
                    type="button"
                    className="logout-button"
                    disabled={historyPage <= 1 || historyLoading}
                    onClick={() => setHistoryPage((page) => page - 1)}
                  >
                    Previous
                  </button>

                  <span>
                    Page {historyPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    className="logout-button"
                    disabled={
                      historyPage >= totalPages || historyLoading
                    }
                    onClick={() => setHistoryPage((page) => page + 1)}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </section>

          <p className="dashboard-footer">
            LedgerLine · Secure transaction management
          </p>
        </main>
      </div>
    );
  }

  // Login and registration page
  return (
    <div className="app-container">
      <section className="brand-section">
        <div className="brand-logo">L</div>

        <h1>LedgerLine</h1>
        <p>Smart. Secure. Balanced.</p>

        <div className="brand-message">
          <h2>Every transaction tells a story.</h2>

          <p>
            Move money with confidence. Keep your books perfectly
            balanced.
          </p>
        </div>
      </section>

      <section className="form-section">
        <div className="form-card">
          <h2>
            {isLogin ? "Welcome back!" : "Create your account"}
          </h2>

          <p className="subtitle">
            {isLogin
              ? "Sign in to continue to your dashboard."
              : "Register to get started with LedgerLine."}
          </p>

          <div className="tab-buttons">
            <button
              type="button"
              className={isLogin ? "active" : ""}
              onClick={() => {
                setIsLogin(true);
                setMessage("");
              }}
            >
              Login
            </button>

            <button
              type="button"
              className={!isLogin ? "active" : ""}
              onClick={() => {
                setIsLogin(false);
                setMessage("");
              }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuth}>
            {!isLogin && (
              <div className="form-group">
                <label>Full name</label>

                <input
                  name="name"
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Email address</label>

              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>

              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="show-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {message && (
              <div className={`message ${messageType}`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isLogin
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          <p className="footer-text">
            Secure account access powered by LedgerLine.
          </p>
        </div>
      </section>
    </div>
  );
}

export default App;
