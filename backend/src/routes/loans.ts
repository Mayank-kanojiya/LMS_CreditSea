import { randomUUID } from 'crypto';
import { NextFunction, Response, Router } from 'express';
import multer from 'multer';
import path from 'path';
import { UPLOADS_DIR } from '../utils/uploads';
import LoanApplication, { ILoanApplication } from '../models/LoanApplication';
import Payment from '../models/Payment';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

function runBRE(data: {
  fullName: unknown;
  dob: unknown;
  monthlySalary: number;
  pan: unknown;
  employmentMode: unknown;
}): string | null {
  if (typeof data.fullName !== 'string' || !data.fullName.trim()) return 'Full name is required';
  if (typeof data.dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.dob)) return 'Enter a valid date of birth';
  const birthDate = new Date(`${data.dob}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== data.dob || birthDate > new Date()) {
    return 'Enter a valid date of birth';
  }
  const now = new Date();
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  if (
    now.getUTCMonth() < birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() < birthDate.getUTCDate())
  ) age -= 1;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
  if (age < 23 || age > 50) return 'Age must be between 23 and 50';
  if (!Number.isFinite(data.monthlySalary)) return 'Enter a valid monthly salary';
  if (data.monthlySalary < 25000) return 'Monthly salary must be at least ₹25,000';
  if (typeof data.pan !== 'string' || !panRegex.test(data.pan.trim().toUpperCase())) return 'Invalid PAN format';
  if (!['salaried', 'self-employed', 'unemployed'].includes(String(data.employmentMode))) return 'Select a valid employment mode';
  if (data.employmentMode === 'unemployed') return 'Unemployed applicants are not eligible';
  return null;
}

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(new Error('Only PDF, JPG, and PNG files are accepted'));
      return;
    }
    cb(null, true);
  },
});

const uploadSalarySlip = (req: AuthRequest, res: Response, next: NextFunction): void => {
  upload.single('salarySlip')(req, res, error => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ message: 'Salary slip must be 5 MB or smaller' });
      return;
    }
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
      return;
    }
    next();
  });
};

router.post('/personal-details', authenticate, authorize('borrower'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { fullName, pan, dob, monthlySalary, employmentMode } = req.body;
  const normalizedPan = typeof pan === 'string' ? pan.trim().toUpperCase() : pan;
  const salary = Number(monthlySalary);
  const breError = runBRE({ fullName, dob, monthlySalary: salary, pan: normalizedPan, employmentMode });
  if (breError) { res.status(422).json({ message: breError }); return; }
  try {
    let loan = await LoanApplication.findOne({ borrower: req.user!.id, status: 'applied', loanAmount: { $exists: false } }) as ILoanApplication | null;
    if (!loan) {
      loan = await LoanApplication.create({
        borrower: req.user!.id,
        fullName: fullName.trim(),
        pan: normalizedPan,
        dob,
        monthlySalary: salary,
        employmentMode,
      }) as ILoanApplication;
    } else {
      loan.fullName = fullName.trim(); loan.pan = normalizedPan; loan.dob = dob;
      loan.monthlySalary = salary; loan.employmentMode = employmentMode;
      await loan.save();
    }
    res.json({ loanId: loan._id });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/upload-salary-slip/:loanId', authenticate, authorize('borrower'), uploadSalarySlip, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const loan = await LoanApplication.findOne({ _id: req.params.loanId, borrower: req.user!.id }) as ILoanApplication | null;
    if (!loan) { res.status(404).json({ message: 'Loan not found' }); return; }
    if (loan.status !== 'applied' || loan.loanAmount !== undefined) {
      res.status(409).json({ message: 'Salary slip cannot be changed after applying' }); return;
    }
    if (!req.file) { res.status(400).json({ message: 'File required' }); return; }
    loan.salarySlipUrl = req.file.filename;
    await loan.save();
    res.json({ salarySlipUrl: loan.salarySlipUrl });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/apply/:loanId', authenticate, authorize('borrower'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { loanAmount, tenure } = req.body;
    const loan = await LoanApplication.findOne({ _id: req.params.loanId, borrower: req.user!.id }) as ILoanApplication | null;
    if (!loan) { res.status(404).json({ message: 'Loan not found' }); return; }
    if (!loan.salarySlipUrl) { res.status(400).json({ message: 'Upload salary slip first' }); return; }
    const P = Number(loanAmount), T = Number(tenure), R = 12;
    if (loan.status !== 'applied' || loan.loanAmount !== undefined) {
      res.status(409).json({ message: 'This loan application has already been submitted' }); return;
    }
    if (!Number.isInteger(P) || P < 50000 || P > 500000) {
      res.status(400).json({ message: 'Loan amount must be a whole number between ₹50,000 and ₹5,00,000' }); return;
    }
    if (!Number.isInteger(T) || T < 30 || T > 365) {
      res.status(400).json({ message: 'Tenure must be a whole number between 30 and 365 days' }); return;
    }
    const si = (P * R * T) / (365 * 100);
    loan.loanAmount = P; loan.tenure = T;
    loan.totalRepayment = Math.round(P + si);
    loan.status = 'applied';
    await loan.save();
    res.json({ loan });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/my-loans', authenticate, authorize('borrower'), async (req: AuthRequest, res: Response): Promise<void> => {
  const loans = await LoanApplication.find({ borrower: req.user!.id }).sort({ createdAt: -1 });
  const paidByLoan = await Payment.aggregate<{ _id: ILoanApplication['_id']; totalPaid: number }>([
    { $match: { loan: { $in: loans.map(loan => loan._id) } } },
    { $group: { _id: '$loan', totalPaid: { $sum: '$amount' } } },
  ]);
  const totals = new Map(paidByLoan.map(({ _id, totalPaid }) => [String(_id), totalPaid]));
  res.json(loans.map(loan => {
    const amountPaid = totals.get(String(loan._id)) ?? 0;
    return {
      ...loan.toObject(),
      amountPaid,
      outstanding: Math.max(0, (loan.totalRepayment ?? 0) - amountPaid),
    };
  }));
});

router.get('/my-loans/:loanId/payments', authenticate, authorize('borrower'), async (req: AuthRequest, res: Response): Promise<void> => {
  const loan = await LoanApplication.findOne({ _id: req.params.loanId, borrower: req.user!.id }) as ILoanApplication | null;
  if (!loan) { res.status(404).json({ message: 'Not found' }); return; }
  const payments = await Payment.find({ loan: loan._id }).sort({ date: -1 });
  res.json(payments);
});

export default router;
