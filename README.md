# LedgerLine – Secure Money Transfer System

## 1. Project Overview

LedgerLine is a secure money transfer simulation system designed to demonstrate how digital financial transactions can be processed reliably. It allows authenticated users to manage their accounts, transfer funds, and view transaction history.

The system focuses on secure authentication, transaction consistency, account ownership validation, and reliable transaction processing.

**Note:** This is a project simulation. It does not process real banking transactions.

## 2. Key Features

- User registration and login with password hashing.
- JWT-based authentication and protected API routes.
- Account management and account balance viewing.
- Secure money transfers between accounts.
- Account ownership validation.
- Prevention of insufficient-balance and same-account transfers.
- Idempotency to prevent duplicate transfer processing.
- Database transactions and row locking for consistent fund transfers.
- Double-entry ledger records for debit and credit operations.
- Transaction history.
- Audit logging for important activities.

## 3. Technologies Used

| Technology | Purpose |
|---|---|
| React | Frontend user interface |
| Vite | Frontend development environment |
| Node.js | Backend runtime |
| Express.js | REST API development |
| PostgreSQL | Relational database |
| JWT | User authentication |
| bcrypt | Password hashing |
| pg | PostgreSQL connectivity |
| Helmet | HTTP security headers |

## 4. Project Architecture

LedgerLine follows a frontend-backend-database architecture.

- **Frontend:** React application for user interaction.
- **Backend:** Node.js and Express handle authentication, account operations, and transfers.
- **Database:** PostgreSQL stores users, accounts, transactions, ledger entries, and audit logs.

## 5. Main Modules

- **Authentication Module:** Handles registration, login, and JWT verification.
- **Account Module:** Retrieves accounts belonging to the authenticated user.
- **Transfer Module:** Validates and processes fund transfers.
- **Transaction Module:** Provides transaction history.
- **Ledger Module:** Maintains debit and credit entries.
- **Audit Module:** Records important system activities.

## 6. Installation and Setup

### Prerequisites

- Node.js and npm
- PostgreSQL
- Git
- Visual Studio Code

### Backend Setup

Clone the repository:

```bash
git clone https://github.com/shaikfahmiyaiffat/LedgerLine.git
cd LedgerLine
```

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root and configure your local PostgreSQL connection and JWT secret.

Example configuration (replace the placeholder values with your own):

```env
PORT=5001
DB_USER=your_database_user
DB_HOST=localhost
DB_NAME=ledgerline_db
DB_PASSWORD=your_database_password
DB_PORT=5432
JWT_SECRET=your_secret_key
```

Configure the PostgreSQL database and required tables before starting the backend.

Start the backend:

```bash
npm start
```

### Frontend Setup

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite in your browser.

## 7. Main API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register a user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Retrieve authenticated user profile |
| GET | `/api/accounts` | Retrieve user's accounts |
| POST | `/api/transfers` | Process a money transfer |
| GET | `/api/transactions` | Retrieve transaction history |

Protected endpoints require a valid JWT access token.

## 8. Database Components

The PostgreSQL database contains the following main tables:

- `users` – Stores user information and hashed passwords.
- `accounts` – Stores account details and balances.
- `transactions` – Stores transfer information and status.
- `ledger_entries` – Stores debit and credit records.
- `audit_logs` – Stores records of important system activities.

## 9. Reliability and Security

- Passwords are hashed using bcrypt.
- JWT authentication protects sensitive API operations.
- Account ownership is validated before transfers.
- Database transactions ensure transfer operations are handled atomically.
- Row-level locking helps prevent conflicting concurrent updates.
- Idempotency keys prevent duplicate processing of the same transfer request.
- Ledger entries maintain corresponding debit and credit records.
- Audit logs provide activity traceability.

## 10. Conclusion

LedgerLine demonstrates the implementation of a secure and reliable money transfer simulation using modern web technologies. It combines authentication, transaction processing, database consistency, idempotency, ledger management, and audit logging in a single application.

## 11. Repository

GitHub: https://github.com/shaikfahmiyaiffat/LedgerLine
