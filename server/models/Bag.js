import mongoose from 'mongoose';

const colorVariantSchema = new mongoose.Schema({
  colorName: { type: String, required: true, trim: true },
  colorHex: { type: String, default: '#142B22', trim: true },
  stock: { type: Number, required: true, default: 1, min: 0 },
  images: [{ type: String }],
});

const bagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, default: 1, min: 0 },
    description: { type: String, default: '', trim: true },
    colorName: { type: String, default: 'Classic', trim: true },
    colorHex: { type: String, default: '#142B22', trim: true },
    image: { type: String, required: true }, // Primary cover photo
    images: [{ type: String }], // Primary color gallery (up to 7 photos)
    variants: [colorVariantSchema], // Additional color options with their own photos & stock
    inStock: { type: Boolean, default: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Bag', bagSchema);