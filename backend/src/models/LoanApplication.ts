import mongoose, { Document, Schema } from 'mongoose';

export type LoanStatus = 'applied' | 'sanctioned' | 'rejected' | 'disbursed' | 'closed';

export interface ILoanApplication extends Document {
  borrower: mongoose.Types.ObjectId;
  // Personal details
  fullName: string;
  pan: string;
  dob: string;
  monthlySalary: number;
  employmentMode: 'salaried' | 'self-employed' | 'unemployed';
  // Salary slip
  salarySlipUrl?: string;
  // Loan config
  loanAmount?: number;
  tenure?: number; // days
  interestRate: number;
  totalRepayment?: number;
  amountPaid: number;
  // Status
  status: LoanStatus;
  rejectionReason?: string;
  // Tracking
  sanctionedBy?: mongoose.Types.ObjectId;
  disbursedBy?: mongoose.Types.ObjectId;
}

const LoanSchema = new Schema<ILoanApplication>({
  borrower: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, required: true },
  pan: { type: String, required: true },
  dob: { type: String, required: true },
  monthlySalary: { type: Number, required: true },
  employmentMode: { type: String, enum: ['salaried', 'self-employed', 'unemployed'], required: true },
  salarySlipUrl: { type: String },
  loanAmount: { type: Number },
  tenure: { type: Number },
  interestRate: { type: Number, default: 12 },
  totalRepayment: { type: Number },
  amountPaid: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['applied', 'sanctioned', 'rejected', 'disbursed', 'closed'], default: 'applied' },
  rejectionReason: { type: String },
  sanctionedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  disbursedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model<ILoanApplication>('LoanApplication', LoanSchema);
