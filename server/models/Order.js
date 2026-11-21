import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    bagId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bag' },
    bagName: { type: String, default: '' },
    selectedColor: { type: String, default: 'Classic' },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
    image: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    delivery: {
      city: { type: String, default: 'Lagos' },
      area: { type: String, required: true },
      streetAddress: { type: String, required: true },
      phone: { type: String, required: true },
      fee: { type: Number, required: true },
      courierName: { type: String, default: '' },
      eta: { type: String, default: '' },
      weightKg: { type: Number, default: 3 },
    },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    paystackReference: { type: String, unique: true, sparse: true },
    paymentChannel: { type: String, default: 'paystack_titan_transfer' },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending',
    },
    fulfilledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);