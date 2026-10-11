import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import LoanApplication, { ILoanApplication } from '../models/LoanApplication';
import Payment from '../models/Payment';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

function runBRE(data: { dob: string; monthlySalary: number; pan: string; employmentMode: string }): string | null {
  const age = Math.floor((Date.now() - new Date(data.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  if (age < 23 || age > 50) return 'Age must be between 23 and 50';
  if (data.monthlySalary < 25000) return 'Monthly salary must be at least ₹25,000';
  if (!panRegex.test(data.pan)) return 'Invalid PAN format';
  if (data.employmentMode === 'unemployed') return 'Unemployed applicants are not eligible';
  return null;
}

const storage = multer.diskStorage({
  destination: 'src/uploads/',
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

router.post('/personal-details', authenticate, authorize('borrower'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { fullName, pan, dob, monthlySalary, employmentMode } = req.body;
  const breError = runBRE({ dob, monthlySalary: Number(monthlySalary), pan, employmentMode });
  if (breError) { res.status(422).json({ message: breError }); return; }
  try {
    let loan = await LoanApplication.findOne({ borrower: req.user!.id, status: 'applied', loanAmount: { $exists: false } }) as ILoanApplication | null;
    if (!loan) {
      loan = await LoanApplication.create({ borrower: req.user!.id, fullName, pan, dob, monthlySalary, employmentMode }) as ILoanApplication;
    } else {
      loan.fullName = fullName; loan.pan = pan; loan.dob = dob;
      loan.monthlySalary = monthlySalary; loan.employmentMode = employmentMode;
      await loan.save();
    }
    res.json({ loanId: loan._id });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/upload-salary-slip/:loanId', authenticate, authorize('borrower'), upload.single('salarySlip'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const loan = await LoanApplication.findOne({ _id: req.params.loanId, borrower: req.user!.id }) as ILoanApplication | null;
    if (!loan) { res.status(404).json({ message: 'Loan not found' }); return; }
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
    if (P < 50000 || P > 500000) { res.status(400).json({ message: 'Loan amount must be between ₹50,000 and ₹5,00,000' }); return; }
    if (T < 30 || T > 365) { res.status(400).json({ message: 'Tenure must be between 30 and 365 days' }); return; }
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
