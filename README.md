# Loan Management System

Full-stack LMS built with MERN + Next.js + TypeScript.

## Tech Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express.js + TypeScript
- **Database**: MongoDB + Mongoose
- **Auth**: JWT + bcrypt

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally on port 27017

### Backend

```bash
cd backend
cp .env.example .env   # edit values if needed
npm install
npm run seed           # creates one account per role
npm run dev            # starts on http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # starts on http://localhost:3000
```

## Seed Credentials

| Role        | Email                | Password        |
|-------------|----------------------|-----------------|
| Admin       | admin@lms.com        | Admin@123       |
| Sales       | sales@lms.com        | Sales@123       |
| Sanction    | sanction@lms.com     | Sanction@123    |
| Disbursement| disburse@lms.com     | Disburse@123    |
| Collection  | collection@lms.com   | Collection@123  |
| Borrower    | borrower@lms.com     | Borrower@123    |

## API Overview

### Auth
| Method | Endpoint           | Description     |
|--------|--------------------|-----------------|
| POST   | /api/auth/signup   | Register borrower |
| POST   | /api/auth/login    | Login any role  |

### Borrower Flow
| Method | Endpoint                              | Description              |
|--------|---------------------------------------|--------------------------|
| POST   | /api/loans/personal-details           | Step 2: BRE + save details |
| POST   | /api/loans/upload-salary-slip/:loanId | Step 3: Upload file      |
| POST   | /api/loans/apply/:loanId              | Step 4: Configure & apply |
| GET    | /api/loans/my-loans                   | Get own loans            |

### Dashboard
| Method | Endpoint                                      | Role              |
|--------|-----------------------------------------------|-------------------|
| GET    | /api/dashboard/sales/leads                    | Sales, Admin      |
| GET    | /api/dashboard/sanction/loans                 | Sanction, Admin   |
| PATCH  | /api/dashboard/sanction/loans/:id             | Sanction, Admin   |
| GET    | /api/dashboard/disbursement/loans             | Disbursement, Admin |
| PATCH  | /api/dashboard/disbursement/loans/:id         | Disbursement, Admin |
| GET    | /api/dashboard/collection/loans               | Collection, Admin |
| POST   | /api/dashboard/collection/loans/:id/payments  | Collection, Admin |
| GET    | /api/dashboard/collection/loans/:id/payments  | Collection, Admin |

## Loan Lifecycle
```
APPLIED → SANCTIONED → DISBURSED → CLOSED
       ↘ REJECTED
```

## BRE Rules
- Age: 23–50
- Monthly Salary: ≥ ₹25,000
- PAN: valid format (e.g. ABCDE1234F)
- Employment: not unemployed

## Interest Calculation
```
SI = (P × R × T) / (365 × 100)   where R = 12% p.a., T = tenure in days
Total Repayment = P + SI
```
