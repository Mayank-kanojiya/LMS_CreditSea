# Loan Management System

A loan management application with a borrower portal and role-based operations dashboards.

## Tech stack

- Frontend: Next.js App Router, React, TypeScript, and Tailwind CSS
- Backend: Node.js, Express, and TypeScript
- Database: MongoDB with Mongoose
- Authentication: JWT and bcrypt

## Requirements

- Node.js 20.9 or newer
- npm
- MongoDB running locally on port 27017, or a MongoDB connection URI
- PowerShell for the Windows commands below

## Setup and run (PowerShell)

Start MongoDB if it is installed as a Windows service:

```powershell
Start-Service MongoDB
```

In a terminal for the backend:

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run seed
npm run dev
```

The backend reads its settings from `backend/.env` and serves the API at
`http://localhost:5000`. The seed command creates or updates the demo account
for each role; run it once when preparing the database.

In a second terminal for the frontend:

```powershell
cd frontend
Copy-Item .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. Keep both development servers and MongoDB running
while using the application. Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local`
to the backend API URL if the backend is hosted somewhere other than
`http://localhost:5000/api`.

## Seed credentials

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@lms.com | Admin@123 |
| Sales | sales@lms.com | Sales@123 |
| Sanction | sanction@lms.com | Sanction@123 |
| Disbursement | disburse@lms.com | Disburse@123 |
| Collection | collection@lms.com | Collection@123 |
| Borrower | borrower@lms.com | Borrower@123 |

## Borrower application and eligibility

Borrowers register or sign in, submit personal details, upload a salary slip,
then choose a loan amount and tenure. Eligibility is checked by the backend:

- Age from 23 through 50
- Monthly salary of at least ₹25,000
- PAN matching `^[A-Z]{5}[0-9]{4}[A-Z]$`
- Employment mode must not be unemployed

Salary slips may be PDF, JPG, or PNG and are limited to 5 MB. Loan amounts are
₹50,000–₹5,00,000, tenures are 30–365 days, and simple interest is calculated
at 12% p.a. using the number of tenure days.

## Operations dashboard

The lifecycle is `applied → sanctioned → disbursed → closed`; a sanction
officer may instead reject an applied loan with a reason. Sales, sanction,
disbursement, and collection roles can access their own modules. Admins can
access all modules. The backend enforces role access independently of the
frontend navigation.

Collection records require a unique UTR, positive payment amount, and date.
Payments cannot exceed the outstanding balance; a loan closes when payments
reach the total repayment.

## API overview

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/signup` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/loans/personal-details` | Borrower |
| POST | `/api/loans/upload-salary-slip/:loanId` | Borrower |
| POST | `/api/loans/apply/:loanId` | Borrower |
| GET | `/api/loans/my-loans` | Borrower |
| GET | `/api/dashboard/sales/leads` | Sales, Admin |
| GET/PATCH | `/api/dashboard/sanction/loans` and `/api/dashboard/sanction/loans/:id` | Sanction, Admin |
| GET/PATCH | `/api/dashboard/disbursement/loans` and `/api/dashboard/disbursement/loans/:id` | Disbursement, Admin |
| GET/POST | `/api/dashboard/collection/loans` and `/api/dashboard/collection/loans/:id/payments` | Collection, Admin |
