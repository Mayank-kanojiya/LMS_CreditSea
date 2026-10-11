import { Router, Response } from 'express';
import User from '../models/User';
import LoanApplication, { ILoanApplication } from '../models/LoanApplication';
import Payment, { IPayment } from '../models/Payment';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/sales/leads', authenticate, authorize('sales', 'admin'), async (_req: AuthRequest, res: Response): Promise<void> => {
  const borrowers = await User.find({ role: 'borrower' }, '-password');
  const appliedIds = await LoanApplication.distinct('borrower', { loanAmount: { $exists: true } });
  const appliedSet = new Set(appliedIds.map(String));
  const leads = borrowers.filter(b => !appliedSet.has(String(b._id)));
  res.json(leads);
});

router.get('/sanction/loans', authenticate, authorize('sanction', 'admin'), async (_req: AuthRequest, res: Response): Promise<void> => {
  const loans = await LoanApplication.find({ status: 'applied', loanAmount: { $exists: true } }).populate('borrower', '-password');
  res.json(loans);
});

router.patch('/sanction/loans/:id', authenticate, authorize('sanction', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { action, rejectionReason } = req.body;
  const loan = await LoanApplication.findById(req.params.id) as ILoanApplication | null;
  if (!loan || loan.status !== 'applied') { res.status(404).json({ message: 'Loan not found or not in applied state' }); return; }
  if (action === 'approve') {
    loan.status = 'sanctioned';
    loan.sanctionedBy = req.user!.id as any;
  } else if (action === 'reject') {
    if (typeof rejectionReason !== 'string' || !rejectionReason.trim()) {
      res.status(400).json({ message: 'A rejection reason is required' }); return;
    }
    loan.status = 'rejected';
    loan.rejectionReason = rejectionReason.trim();
  } else {
    res.status(400).json({ message: 'Invalid action' }); return;
  }
  await loan.save();
  res.json(loan);
});

router.get('/disbursement/loans', authenticate, authorize('disbursement', 'admin'), async (_req: AuthRequest, res: Response): Promise<void> => {
  const loans = await LoanApplication.find({ status: 'sanctioned' }).populate('borrower', '-password');
  res.json(loans);
});

router.patch('/disbursement/loans/:id', authenticate, authorize('disbursement', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const loan = await LoanApplication.findById(req.params.id) as ILoanApplication | null;
  if (!loan || loan.status !== 'sanctioned') { res.status(404).json({ message: 'Loan not found or not sanctioned' }); return; }
  loan.status = 'disbursed';
  loan.disbursedBy = req.user!.id as any;
  await loan.save();
  res.json(loan);
});

router.get('/collection/loans', authenticate, authorize('collection', 'admin'), async (_req: AuthRequest, res: Response): Promise<void> => {
  const loans = await LoanApplication.find({ status: { $in: ['disbursed', 'closed'] } }).populate('borrower', '-password');
  const paidByLoan = await Payment.aggregate<{ _id: ILoanApplication['_id']; totalPaid: number }>([
    { $match: { loan: { $in: loans.map(loan => loan._id) } } },
    { $group: { _id: '$loan', totalPaid: { $sum: '$amount' } } },
  ]);
  const totals = new Map(paidByLoan.map(({ _id, totalPaid }) => [String(_id), totalPaid]));
  res.json(loans.map(loan => {
    const totalPaid = totals.get(String(loan._id)) ?? 0;
    return {
      ...loan.toObject(),
      amountPaid: totalPaid,
      outstanding: Math.max(0, (loan.totalRepayment ?? 0) - totalPaid),
    };
  }));
});

router.post('/collection/loans/:id/payments', authenticate, authorize('collection', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { utr, amount, date } = req.body;
  const loan = await LoanApplication.findById(req.params.id) as ILoanApplication | null;
  if (!loan || loan.status !== 'disbursed') { res.status(404).json({ message: 'Loan not found or not disbursed' }); return; }

  const normalizedUtr = typeof utr === 'string' ? utr.trim() : '';
  if (!normalizedUtr) { res.status(400).json({ message: 'UTR number is required' }); return; }

  const paymentAmount = Number(amount);
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    res.status(400).json({ message: 'Amount must be a positive number' }); return;
  }
  if (typeof date !== 'string' || !date.trim() || Number.isNaN(Date.parse(date))) {
    res.status(400).json({ message: 'A valid payment date is required' }); return;
  }

  const utrExists = await Payment.findOne({ utr: normalizedUtr });
  if (utrExists) { res.status(409).json({ message: 'UTR already exists' }); return; }

  // Backfill loans created before amountPaid was added, without overwriting newer totals.
  const priorPayments = await Payment.aggregate<{ totalPaid: number }>([
    { $match: { loan: loan._id } },
    { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
  ]);
  await LoanApplication.updateOne(
    { _id: loan._id, amountPaid: { $exists: false } },
    { $set: { amountPaid: priorPayments[0]?.totalPaid ?? 0 } },
  );

  const reservedLoan = await LoanApplication.findOneAndUpdate(
    {
      _id: loan._id,
      status: 'disbursed',
      $expr: { $lte: [{ $add: ['$amountPaid', paymentAmount] }, '$totalRepayment'] },
    },
    { $inc: { amountPaid: paymentAmount } },
    { new: true },
  ) as ILoanApplication | null;
  if (!reservedLoan) {
    const latestLoan = await LoanApplication.findById(loan._id);
    if (!latestLoan || latestLoan.status !== 'disbursed') {
      res.status(409).json({ message: 'Loan is no longer active for collection' }); return;
    }
    const outstanding = Math.max(0, (latestLoan.totalRepayment ?? 0) - (latestLoan.amountPaid ?? 0));
    res.status(400).json({ message: `Amount exceeds outstanding balance of ₹${outstanding}` }); return;
  }

  let payment: IPayment;
  try {
    payment = await Payment.create({
      loan: loan._id,
      utr: normalizedUtr,
      amount: paymentAmount,
      date: new Date(date),
      recordedBy: req.user!.id,
    }) as IPayment;
  } catch (error) {
    await LoanApplication.updateOne({ _id: loan._id }, { $inc: { amountPaid: -paymentAmount } });
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
      res.status(409).json({ message: 'UTR already exists' }); return;
    }
    throw error;
  }

  if (reservedLoan.amountPaid >= (reservedLoan.totalRepayment ?? 0)) {
    reservedLoan.status = 'closed';
    await reservedLoan.save();
  }

  res.status(201).json({ payment, loanStatus: reservedLoan.status });
});

router.get('/collection/loans/:id/payments', authenticate, authorize('collection', 'admin'), async (req: AuthRequest, res: Response): Promise<void> => {
  const loan = await LoanApplication.findById(req.params.id) as ILoanApplication | null;
  if (!loan) { res.status(404).json({ message: 'Loan not found' }); return; }
  const payments = await Payment.find({ loan: loan._id }).sort({ date: -1 }) as IPayment[];
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  res.json({ payments, totalPaid, outstanding: Math.max(0, (loan.totalRepayment ?? 0) - totalPaid) });
});

router.get('/admin/loans', authenticate, authorize('admin'), async (_req: AuthRequest, res: Response): Promise<void> => {
  const loans = await LoanApplication.find().populate('borrower', '-password').sort({ createdAt: -1 });
  res.json(loans);
});

export default router;
