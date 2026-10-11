import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  loan: mongoose.Types.ObjectId;
  utr: string;
  amount: number;
  date: Date;
  recordedBy: mongoose.Types.ObjectId;
}

const PaymentSchema = new Schema<IPayment>({
  loan: { type: Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
  utr: { type: String, required: true, unique: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  date: { type: Date, required: true },
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export default mongoose.model<IPayment>('Payment', PaymentSchema);
