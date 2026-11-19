import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import path from 'path';
import { fileURLToPath } from 'url';

import User from './models/User.js';
import Bag from './models/Bag.js';
import Collection from './models/Collection.js';
import Order from './models/Order.js';
import Settings from './models/Settings.js';
import { protect, adminOnly, staffOnly } from './middleware/auth.js';
import { customerOnly } from './middleware/customerOnly.js';

dotenv.config();
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://www.singlechoice.ng',
  'https://singlechoice.ng',
  'https://single-choice-store.vercel.app',
  'https://choice-store.vercel.app',
  'http://localhost:5173',
]
  .filter(Boolean)
  .map((url) => url.trim().replace(/\/+$/, ''));

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (like curl/health checks) or allowlisted origins
      const normalizedOrigin = origin ? origin.trim().replace(/\/+$/, '') : '';
      if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Single Choice API' });
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'single-choice-handbags',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
});

const videoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'single-choice-campaigns',
    resource_type: 'video',
    allowed_formats: ['mp4', 'webm', 'mov'],
  },
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 80 * 1024 * 1024 },
});

const extractCloudinaryPublicId = (url) => {
  if (!url || !url.includes('res.cloudinary.com')) return null;
  const parts = url.split('/upload/');
  if (parts.length < 2) return null;
  const afterUpload = parts[1].replace(/^v\d+\//, '');
  return afterUpload.replace(/\.[^/.]+$/, '');
};

const signToken = (user) =>
  jwt.sign(
    { id: user._id, role: user.role, tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

const sendBrevoEmail = async ({ toEmail, toName, subject, textContent, htmlContent, replyTo }) => {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || '1singlechoice@gmail.com').trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'Single Choice').trim();

  if (!apiKey) {
    console.warn('BREVO_API_KEY is not set; skipping email send.');
    return null;
  }

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: toEmail, name: toName || toEmail }],
    subject,
    ...(htmlContent && { htmlContent }),
    ...(textContent && { textContent }),
    ...(replyTo && { replyTo: { email: replyTo } }),
  };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Brevo API error (${response.status}): ${errText}`);
  }

  return response.json();
};

const sendCustomerOtpEmail = async (email, name, otp) => {
  setImmediate(() => {
    sendBrevoEmail({
      toEmail: email,
      toName: name,
      replyTo: process.env.BREVO_SENDER_EMAIL || process.env.SMTP_USER || '1singlechoice@gmail.com',
      subject: `${otp} is your Single Choice account code`,
      textContent: `Hi ${name},\n\nYour account confirmation code is: ${otp}\n\nThis code is valid for 10 minutes.`,
      htmlContent: `
        <div style="font-family: Georgia, serif; max-width: 500px; margin: auto; padding: 28px; border: 1px solid #E8E2D9; background: #FFFFFF; color: #222222;">
          <h2 style="color: #142B22; margin-top: 0;">Hi ${name},</h2>
          <p style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #444444;">
            Please enter the confirmation code below to finish setting up your profile:
          </p>
          <div style="font-family: Arial, sans-serif; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #142B22; background: #FAF8F5; padding: 14px; text-align: center; margin: 20px 0; border: 1px solid #C5A059;">
            ${otp}
          </div>
        </div>
      `,
    }).catch((err) => console.error('OTP email error:', err.message));
  });
};

const sendOrderEmails = async (order, customer, stage = 'placed') => {
  const boutiqueEmail = (process.env.CONCIERGE_TO_EMAIL || '1singlechoice@gmail.com').trim();
  const shortOrderId = order._id.toString().slice(-6).toUpperCase();
  const isPaid = stage === 'paid' || order.paymentStatus === 'paid';
  const statusLabel = isPaid ? 'PAYMENT CONFIRMED (PAID)' : 'NEW ORDER PLACED (AWAITING TRANSFER)';

  const itemsText = order.items
    .map(
      (item) =>
        `• ${item.name} — Qty: ${item.qty} × ₦${item.price.toLocaleString()} = ₦${(
          item.price * item.qty
        ).toLocaleString()}`
    )
    .join('\n');

  setImmediate(() => {
    sendBrevoEmail({
      toEmail: boutiqueEmail,
      toName: 'Single Choice Concierge',
      replyTo: customer.email,
      subject: `[${isPaid ? 'PAID ORDER' : 'ORDER PLACED'}] #${shortOrderId} — ${customer.name} (${order.delivery.area})`,
      textContent: `${statusLabel} (#${shortOrderId})\n\nCustomer: ${customer.name} (${customer.email})\nPhone: ${order.delivery.phone}\nAddress: ${order.delivery.streetAddress}, ${order.delivery.area}\n\nItems:\n${itemsText}\n\nTotal: ₦${order.totalAmount.toLocaleString()}`,
    }).catch((err) => console.error('Admin order email error:', err.message));
  });
};

const fulfillPaidOrder = async (reference) => {
  const existingOrder = await Order.findOne({ paystackReference: reference });
  if (!existingOrder) return null;
  if (existingOrder.paymentStatus === 'paid') return existingOrder;

  const confirmedOrder = await Order.findOneAndUpdate(
    { paystackReference: reference, paymentStatus: { $ne: 'paid' } },
    { paymentStatus: 'paid' },
    { new: true }
  );

  if (!confirmedOrder) return Order.findOne({ paystackReference: reference });

  const user = await User.findById(confirmedOrder.customer);
  if (user && user.cart.length > 0) {
    for (const item of user.cart) {
      const bag = await Bag.findById(item.bag);
      if (bag) {
        const primaryColor = bag.colorName || 'Classic';
        const chosenColor = (item.selectedColor || primaryColor).toLowerCase();

        if (chosenColor === primaryColor.toLowerCase()) {
          bag.stock = Math.max(0, (bag.stock ?? 1) - item.qty);
        } else {
          const variant = (bag.variants || []).find(
            (v) => v.colorName.toLowerCase() === chosenColor
          );
          if (variant) {
            variant.stock = Math.max(0, (variant.stock ?? 1) - item.qty);
          }
        }

        const totalRemaining =
          (bag.stock ?? 0) +
          (bag.variants || []).reduce((sum, v) => sum + (v.stock ?? 0), 0);
        bag.inStock = totalRemaining > 0;
        await bag.save();
      }
    }
    user.cart = [];
    await user.save();
  }

  if (user) {
    await sendOrderEmails(confirmedOrder, user, 'paid').catch(() => {});
  }

  return confirmedOrder;
};

const seedInitialData = async () => {
  const adminExists = await User.findOne({ role: 'admin' });
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10);
    await User.create({
      name: process.env.ADMIN_NAME || 'Single Choice Admin',
      email: process.env.ADMIN_EMAIL || 'admin@singlechoice.ng',
      password: hashedPassword,
      role: 'admin',
      isVerified: true,
    });
  }

  const settingsExist = await Settings.findOne({ key: 'storefront' });
  if (!settingsExist) {
    await Settings.create({
      key: 'storefront',
      heroEyebrow: 'SINGLE CHOICE • CAMPAIGN 2026',
      heroTitle: 'The Art of Carrying',
      heroSubtitle:
        'Curated designer silhouettes crafted for timeless presence. Explore every angle, swatch, and limited release.',
      heroCtaText: 'Discover the Collection',
    });
  }

  const colCount = await Collection.countDocuments();
  if (colCount === 0) {
    await Collection.insertMany([
      { name: 'Tote Bags' },
      { name: 'Crossbody' },
      { name: 'Clutches' },
      { name: 'New Arrivals' },
    ]);
  }
};

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ message: 'Please enter your name, email, and message.' });
    }

    const boutiqueEmail = (process.env.CONCIERGE_TO_EMAIL || '1singlechoice@gmail.com').trim();
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanPhone = (phone || '').trim();
    const cleanSubject = (subject || '').trim();
    const cleanMessage = message.trim();

    await sendBrevoEmail({
      toEmail: boutiqueEmail,
      toName: 'Single Choice Concierge',
      replyTo: cleanEmail,
      subject: cleanSubject
        ? `[Concierge] ${cleanSubject} — ${cleanName}`
        : `[Concierge Inquiry] From ${cleanName}`,
      textContent: `Name: ${cleanName}\nEmail: ${cleanEmail}\nPhone / WhatsApp: ${cleanPhone || 'Not provided'}\n\nMessage:\n${cleanMessage}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; padding: 24px; border: 1px solid #E8E2D9; background: #FFFFFF; color: #222222;">
          <h2 style="color: #142B22; margin-top: 0;">New Client Concierge Message</h2>
          <p><strong>Name:</strong> ${cleanName}</p>
          <p><strong>Email:</strong> ${cleanEmail}</p>
          <p><strong>Phone / WhatsApp:</strong> ${cleanPhone || 'Not provided'}</p>
          <hr style="border: none; border-top: 1px solid #E8E2D9; margin: 16px 0;" />
          <p style="white-space: pre-line; line-height: 1.6;">${cleanMessage}</p>
        </div>
      `,
    });

    res.json({ message: 'Thank you for reaching out! Our concierge team has received your message.' });
  } catch (err) {
    console.error('Contact email error:', err.message);
    res.status(500).json({ message: 'Unable to send message right now.' });
  }
});

// Storefront Settings & Editable Hero Text
app.get('/api/settings', async (req, res) => {
  const settings = await Settings.findOne({ key: 'storefront' });
  res.json(
    settings || {
      heroImage: '',
      heroVideo: '',
      heroEyebrow: 'SINGLE CHOICE • CAMPAIGN 2026',
      heroTitle: 'The Art of Carrying',
      heroSubtitle:
        'Curated designer silhouettes crafted for timeless presence. Explore every angle, swatch, and limited release.',
      heroCtaText: 'Discover the Collection',
    }
  );
});

app.put('/api/admin/settings/text', protect, adminOnly, async (req, res) => {
  try {
    const { heroEyebrow, heroTitle, heroSubtitle, heroCtaText } = req.body;
    const updated = await Settings.findOneAndUpdate(
      { key: 'storefront' },
      {
        ...(heroEyebrow !== undefined && { heroEyebrow }),
        ...(heroTitle !== undefined && { heroTitle }),
        ...(heroSubtitle !== undefined && { heroSubtitle }),
        ...(heroCtaText !== undefined && { heroCtaText }),
      },
      { new: true, upsert: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/admin/settings/hero', protect, adminOnly, upload.single('heroFile'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Please select a banner photo.' });
    const existing = await Settings.findOne({ key: 'storefront' });
    const oldPublicId = extractCloudinaryPublicId(existing?.heroImage);
    if (oldPublicId) await cloudinary.uploader.destroy(oldPublicId).catch(() => {});

    const updated = await Settings.findOneAndUpdate(
      { key: 'storefront' },
      { heroImage: req.file.path },
      { new: true, upsert: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post(
  '/api/admin/settings/video',
  protect,
  adminOnly,
  uploadVideo.single('heroVideoFile'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Please select a campaign video.' });
      const existing = await Settings.findOne({ key: 'storefront' });
      const oldPublicId = extractCloudinaryPublicId(existing?.heroVideo);
      if (oldPublicId) {
        await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'video' }).catch(() => {});
      }

      const updated = await Settings.findOneAndUpdate(
        { key: 'storefront' },
        { heroVideo: req.file.path },
        { new: true, upsert: true }
      );
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

app.delete('/api/admin/settings/video', protect, adminOnly, async (req, res) => {
  try {
    const existing = await Settings.findOne({ key: 'storefront' });
    const oldPublicId = extractCloudinaryPublicId(existing?.heroVideo);
    if (oldPublicId) {
      await cloudinary.uploader.destroy(oldPublicId, { resource_type: 'video' }).catch(() => {});
    }

    const updated = await Settings.findOneAndUpdate(
      { key: 'storefront' },
      { heroVideo: '' },
      { new: true, upsert: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Auth Routes (with 6-digit OTP & Password Reset)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });

    if (existing && existing.isVerified) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    if (existing && !existing.isVerified) {
      existing.name = name.trim();
      existing.password = hashedPassword;
      existing.otpCode = otp;
      existing.otpExpires = otpExpires;
      await existing.save();
    } else {
      await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: 'customer',
        isVerified: false,
        otpCode: otp,
        otpExpires,
      });
    }

    sendCustomerOtpEmail(normalizedEmail, name.trim(), otp).catch((e) =>
      console.error('OTP email error:', e.message)
    );
    res.status(201).json({ requiresOtp: true, email: normalizedEmail, message: 'Verification code sent.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim(), role: 'customer' });
    if (!user) return res.status(404).json({ message: 'Account not found.' });

    if (user.isVerified) {
      return res.json({
        token: signToken(user),
        user: { id: user._id, name: user.name, email: user.email, role: user.role },
      });
    }

    if (!user.otpCode || user.otpCode !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    if (user.otpExpires && new Date() > user.otpExpires) {
      return res.status(400).json({ message: 'Verification code has expired.' });
    }

    user.isVerified = true;
    user.otpCode = null;
    user.otpExpires = null;
    await user.save();

    res.json({
      token: signToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }
    res.json({
      token: signToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/auth/me', protect, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(404).json({ message: 'No account found with this email.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpCode = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    setImmediate(() => {
      sendBrevoEmail({
        toEmail: normalizedEmail,
        toName: user.name,
        subject: `${otp} is your Single Choice password reset code`,
        textContent: `Your password reset code is: ${otp}. Valid for 10 minutes.`,
      }).catch((err) => console.error('Password reset email error:', err.message));
    });

    res.json({ email: normalizedEmail, message: '6-digit password reset code sent to your email.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Please provide valid code and password (min 6 chars).' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.otpCode || user.otpCode !== otp.trim()) {
      return res.status(400).json({ message: 'Invalid or incorrect 6-digit code.' });
    }

    if (user.otpExpires && new Date() > user.otpExpires) {
      return res.status(400).json({ message: 'Reset code has expired.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.otpCode = null;
    user.otpExpires = null;
    user.isVerified = true;
    await user.save();

    res.json({
      token: signToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      message: 'Password updated successfully.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/collections', async (req, res) => {
  const collections = await Collection.find().sort({ createdAt: 1 });
  res.json(collections);
});

app.post('/api/collections', protect, adminOnly, async (req, res) => {
  try {
    const { name } = req.body;
    const collection = await Collection.create({ name: name.trim() });
    res.status(201).json(collection);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/collections/:id', protect, adminOnly, async (req, res) => {
  await Collection.findByIdAndDelete(req.params.id);
  res.json({ message: 'Collection removed.' });
});

app.get('/api/bags', async (req, res) => {
  const bags = await Bag.find().sort({ createdAt: -1 });
  res.json(bags);
});

app.post('/api/bags', protect, staffOnly, upload.any(), async (req, res) => {
  try {
    const { name, category, price, stock, description, colorName, colorHex } = req.body;
    const primaryFiles = (req.files || []).filter((f) => f.fieldname === 'imageFiles');
    if (primaryFiles.length === 0) {
      return res.status(400).json({ message: 'Please select at least 1 photo.' });
    }

    const primaryImageUrls = primaryFiles.map((f) => f.path);
    const bag = await Bag.create({
      name,
      category,
      price: Number(price),
      stock: Number(stock ?? 1),
      description: description || '',
      colorName: colorName || 'Classic',
      colorHex: colorHex || '#142B22',
      image: primaryImageUrls[0],
      images: primaryImageUrls,
      inStock: Number(stock ?? 1) > 0,
    });
    res.status(201).json(bag);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete('/api/bags/:id', protect, adminOnly, async (req, res) => {
  await Bag.findByIdAndDelete(req.params.id);
  res.json({ message: 'Bag deleted.' });
});

app.get('/api/cart', protect, customerOnly, async (req, res) => {
  const user = await User.findById(req.user._id).populate('cart.bag');
  res.json(user.cart.filter((item) => item.bag !== null));
});

app.post('/api/cart', protect, customerOnly, async (req, res) => {
  const { bagId, qty = 1, selectedColor } = req.body;
  const bag = await Bag.findById(bagId);
  if (!bag) return res.status(404).json({ message: 'Bag not found.' });

  const user = await User.findById(req.user._id);
  const colorToUse = selectedColor || bag.colorName || 'Classic';
  const existing = user.cart.find(
    (item) => item.bag.toString() === bagId && item.selectedColor === colorToUse
  );

  if (existing) {
    existing.qty += Number(qty);
  } else {
    user.cart.push({ bag: bagId, qty: Number(qty), selectedColor: colorToUse });
  }

  await user.save();
  const updated = await User.findById(req.user._id).populate('cart.bag');
  res.json(updated.cart.filter((item) => item.bag !== null));
});

app.delete('/api/cart/:bagId', protect, customerOnly, async (req, res) => {
  const { color } = req.query;
  const user = await User.findById(req.user._id);
  user.cart = user.cart.filter(
    (item) => !(item.bag.toString() === req.params.bagId && (!color || item.selectedColor === color))
  );
  await user.save();
  const updated = await User.findById(req.user._id).populate('cart.bag');
  res.json(updated.cart.filter((item) => item.bag !== null));
});

app.post('/api/checkout/initialize', protect, customerOnly, async (req, res) => {
  try {
    const { area, streetAddress, phone } = req.body;
    const user = await User.findById(req.user._id).populate('cart.bag');
    const validItems = user.cart.filter((i) => i.bag !== null);
    if (validItems.length === 0) return res.status(400).json({ message: 'Cart is empty.' });

    const subtotal = validItems.reduce((sum, i) => sum + i.bag.price * i.qty, 0);
    const deliveryFee = 0; // Rider fee is confirmed after order placement
    const totalAmount = subtotal + deliveryFee;
    const reference = 'SC_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    const createdOrder = await Order.create({
      customer: user._id,
      items: validItems.map((i) => ({
        name: `${i.bag.name} (${i.selectedColor || 'Classic'})`,
        price: i.bag.price,
        qty: i.qty,
      })),
      delivery: {
        area,
        streetAddress,
        phone,
        fee: deliveryFee,
      },
      subtotal,
      totalAmount,
      paystackReference: reference,
    });

    await sendOrderEmails(createdOrder, user, 'placed');

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.json({ authorization_url: '#', reference, subtotal, deliveryFee, totalAmount });
    }

    const rawClientUrl = (process.env.CLIENT_URL || '').trim().replace(/\/+$/, '');
    const clientBase =
      rawClientUrl && !rawClientUrl.includes('choice-store.vercel.app')
        ? rawClientUrl
        : 'https://www.singlechoice.ng';

    const paystackRes = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email: user.email,
        amount: Math.round(totalAmount * 100),
        reference,
        callback_url: `${clientBase}/?reference=${encodeURIComponent(reference)}`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const authorizationUrl = paystackRes.data?.data?.authorization_url || '#';
    res.json({
      authorization_url: authorizationUrl,
      reference,
      subtotal,
      deliveryFee,
      totalAmount,
    });
  } catch (err) {
    res.status(500).json({ message: err.response?.data?.message || err.message });
  }
});

app.get('/api/checkout/verify/:reference', protect, customerOnly, async (req, res) => {
  try {
    const reference = req.params.reference;
    const existingOrder = await Order.findOne({ paystackReference: reference });
    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found for reference.' });
    }

    if (process.env.PAYSTACK_SECRET_KEY) {
      const verifyRes = await axios.get(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );
      const txStatus = verifyRes.data?.data?.status;
      if (txStatus !== 'success') {
        return res.status(400).json({ status: txStatus || 'pending', message: 'Payment not completed yet.' });
      }
    }

    await fulfillPaidOrder(reference);
    res.json({ status: 'paid', message: 'Order confirmed successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.response?.data?.message || err.message });
  }
});

app.get('/api/orders/my', protect, async (req, res) => {
  const orders = await Order.find({ customer: req.user._id }).sort({ createdAt: -1 });
  res.json(orders);
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await seedInitialData();
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`API running on port ${PORT}`));
  })
  .catch((err) => console.error('DB error:', err.message));