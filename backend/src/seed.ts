import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User';
import type { Role } from './models/User';

dotenv.config();

const seeds: { name: string; email: string; password: string; role: Role }[] = [
  { name: 'Admin User',       email: 'admin@lms.com',       password: 'Admin@123',      role: 'admin' },
  { name: 'Sales Executive',  email: 'sales@lms.com',       password: 'Sales@123',      role: 'sales' },
  { name: 'Sanction Officer', email: 'sanction@lms.com',    password: 'Sanction@123',   role: 'sanction' },
  { name: 'Disburse Officer', email: 'disburse@lms.com',    password: 'Disburse@123',   role: 'disbursement' },
  { name: 'Collection Agent', email: 'collection@lms.com',  password: 'Collection@123', role: 'collection' },
  { name: 'Test Borrower',    email: 'borrower@lms.com',    password: 'Borrower@123',   role: 'borrower' },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI!);
  for (const s of seeds) {
    const user = await User.findOne({ email: s.email });
    if (!user) {
      await User.create(s);
      console.log(`Created: ${s.email}`);
    } else {
      user.name = s.name;
      user.password = s.password;
      user.role = s.role;
      await user.save();
      console.log(`Updated: ${s.email}`);
    }
  }
  await mongoose.disconnect();
  console.log('Seed complete.');
}

seed().catch(console.error);
