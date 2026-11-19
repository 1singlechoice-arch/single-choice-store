import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  bag: { type: mongoose.Schema.Types.ObjectId, ref: 'Bag', required: true },
  qty: { type: Number, default: 1, min: 1 },
  selectedColor: { type: String, default: '' },
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'worker', 'customer'],
      default: 'customer',
    },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    otpCode: { type: String, default: null },
    otpExpires: { type: Date, default: null },
    tokenVersion: { type: Number, default: 0 },
    cart: [cartItemSchema],
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);