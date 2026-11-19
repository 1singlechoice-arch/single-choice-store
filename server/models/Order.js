import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        name: String,
        price: Number,
        qty: Number,
        image: String,
      },
    ],
    delivery: {
      city: { type: String, default: 'Lagos' },
      area: { type: String, required: true },
      streetAddress: { type: String, required: true },
      phone: { type: String, required: true },
      fee: { type: Number, required: true },
    },
    subtotal: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    paystackReference: { type: String, unique: true },
    paymentChannel: { type: String, default: 'paystack_titan_transfer' },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);