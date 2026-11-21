import crypto from 'crypto';
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

const DEFAULT_BAG_WEIGHT_KG = Number(process.env.DEFAULT_BAG_WEIGHT_KG) || 3;
const PICKUP_CONFIG = {
  address: (process.env.PICKUP_ADDRESS || 'No. 1 Ifelodun, Community Road, Amikanle, Lagos').trim(),
  city: (process.env.PICKUP_CITY || 'Lagos').trim(),
  state: (process.env.PICKUP_STATE || 'Lagos').trim(),
  country: 'Nigeria',
  lat: Number(process.env.PICKUP_LAT) || 6.652,
  lon: Number(process.env.PICKUP_LON) || 3.249,
};

const ALLOWED_FULFILLMENT_STATUSES = ['processing', 'dispatched', 'delivered', 'cancelled'];

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
      const normalizedOrigin = origin ? origin.trim().replace(/\/+$/, '') : '';
      if (!normalizedOrigin || allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

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

const getAvailableStockForColor = (bag, selectedColor) => {
  if (!bag) return 0;
  const primaryColor = (bag.colorName || 'Classic').trim().toLowerCase();
  const chosenColor = (selectedColor || bag.colorName || 'Classic').trim().toLowerCase();

  if (chosenColor === primaryColor) {
    return Math.max(0, Number(bag.stock ?? 0));
  }

  const matchedVariant = (bag.variants || []).find(
    (v) => (v.colorName || '').trim().toLowerCase() === chosenColor
  );
  if (matchedVariant) {
    return Math.max(0, Number(matchedVariant.stock ?? 0));
  }

  return Math.max(0, Number(bag.stock ?? 0));
};

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

  const deliveryFee = Number(order.delivery?.fee ?? order.deliveryFee ?? 0);
  const courierText = order.delivery?.courierName ? `\nCourier: ${order.delivery.courierName}` : '';

  setImmediate(() => {
    sendBrevoEmail({
      toEmail: boutiqueEmail,
      toName: 'Single Choice Concierge',
      replyTo: customer.email,
      subject: `[${isPaid ? 'PAID ORDER' : 'ORDER PLACED'}] #${shortOrderId} — ${customer.name} (${order.delivery.area})`,
      textContent: `${statusLabel} (#${shortOrderId})\n\nCustomer: ${customer.name} (${customer.email})\nPhone: ${order.delivery.phone}\nAddress: ${order.delivery.streetAddress}, ${order.delivery.area}${courierText}\n\nItems:\n${itemsText}\n\nSubtotal: ₦${Number(order.subtotal || 0).toLocaleString()}\nDelivery Fee: ₦${deliveryFee.toLocaleString()}\nTotal: ₦${Number(order.totalAmount || 0).toLocaleString()}`,
    }).catch((err) => console.error('Admin order email error:', err.message));
  });
};

const sendCustomerFulfillmentEmail = async (order, customer) => {
  if (!customer?.email) return;
  const shortOrderId = order._id.toString().slice(-6).toUpperCase();
  const status = order.fulfillmentStatus || 'processing';
  if (!['dispatched', 'delivered'].includes(status)) return;

  const subject =
    status === 'dispatched'
      ? `Your Single Choice Order #${shortOrderId} Has Been Dispatched`
      : `Your Single Choice Order #${shortOrderId} Has Been Delivered`;

  const trackingLine = order.trackingNumber ? `\nTracking / Waybill #: ${order.trackingNumber}` : '';
  const courierLine = order.delivery?.courierName ? `\nCourier: ${order.delivery.courierName}` : '';

  setImmediate(() => {
    sendBrevoEmail({
      toEmail: customer.email,
      toName: customer.name,
      subject,
      textContent: `Hi ${customer.name},\n\nYour Single Choice order #${shortOrderId} status is now: ${status.toUpperCase()}.${courierLine}${trackingLine}\nDelivery Destination: ${order.delivery?.streetAddress || ''}, ${order.delivery?.area || ''}\n\nThank you for shopping with Single Choice.`,
    }).catch((err) => console.error('Customer fulfillment email error:', err.message));
  });
};

const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === null || lat1 === undefined || lat1 === '' ||
    lon1 === null || lon1 === undefined || lon1 === '' ||
    lat2 === null || lat2 === undefined || lat2 === '' ||
    lon2 === null || lon2 === undefined || lon2 === ''
  ) {
    return null;
  }

  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (!Number.isFinite(nLat1) || !Number.isFinite(nLon1) || !Number.isFinite(nLat2) || !Number.isFinite(nLon2)) {
    return null;
  }

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(nLat2 - nLat1);
  const dLon = toRad(nLon2 - nLon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(nLat1)) * Math.cos(toRad(nLat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const buildFallbackNigeriaQuotes = ({ destinationAddress, city, area, state, weightKg, lat, lon }) => {
  const combinedLocation = `${destinationAddress || ''} ${area || ''} ${city || ''} ${state || ''}`
    .trim()
    .toLowerCase();
  const safeWeight = Math.max(0.5, Number(weightKg) || DEFAULT_BAG_WEIGHT_KG);
  const weightMultiplier = Math.max(1, Math.ceil(safeWeight / DEFAULT_BAG_WEIGHT_KG));

  const hasValidCoords =
    lat !== null &&
    lat !== undefined &&
    lat !== '' &&
    lon !== null &&
    lon !== undefined &&
    lon !== '';

  const distanceKm = hasValidCoords
    ? calculateDistanceKm(PICKUP_CONFIG.lat, PICKUP_CONFIG.lon, lat, lon)
    : null;

  const isLagos =
    combinedLocation.includes('lagos') ||
    ['ikeja', 'lekki', 'victoria island', 'yaba', 'surulere', 'ajah', 'amikanle', 'ikorodu', 'badagry', 'epe', 'agege', 'alimosho', 'ogba', 'maryland'].some(
      (loc) => combinedLocation.includes(loc)
    );

  const isSouthWest = ['ogun', 'abeokuta', 'oyo', 'ibadan', 'osun', 'osogbo', 'ondo', 'akure', 'ekiti', 'ado-ekiti'].some(
    (loc) => combinedLocation.includes(loc)
  );

  const isSouthSouthOrSouthEast = [
    'rivers', 'port harcourt', 'edo', 'benin', 'delta', 'asaba', 'warri',
    'anambra', 'awka', 'onitsha', 'enugu', 'imo', 'owerri', 'abia', 'aba', 'umuahia',
    'akwa ibom', 'uyo', 'cross river', 'calabar', 'bayelsa', 'yenagoa',
  ].some((loc) => combinedLocation.includes(loc));

  const isAbujaOrNorth = [
    'abuja', 'fct', 'wuse', 'maitama', 'garki', 'gwagwalada',
    'kano', 'kaduna', 'niger', 'minna', 'kwara', 'ilorin', 'plateau', 'jos',
    'bauchi', 'gombe', 'adamawa', 'yola', 'borno', 'maiduguri', 'sokoto', 'katsina', 'zamfara', 'kebbi', 'jigawa', 'taraba', 'yobe', 'kogi', 'benue', 'nasarawa',
  ].some((loc) => combinedLocation.includes(loc));

  let baseStandard = 9500;
  let standardEta = '2 - 4 business days';
  let expressDelta = 3500;
  let expressEta = '1 - 2 business days';

  if (distanceKm !== null) {
    if (distanceKm <= 25) {
      baseStandard = 2500;
      standardEta = 'Same day / Next day';
      expressDelta = 1500;
      expressEta = 'Same day express';
    } else if (distanceKm <= 65) {
      baseStandard = 4000;
      standardEta = 'Same day / Next day';
      expressDelta = 2000;
      expressEta = 'Same day express';
    } else if (distanceKm <= 220) {
      baseStandard = 5800;
      standardEta = '1 - 2 business days';
      expressDelta = 2500;
      expressEta = '1 business day';
    } else if (distanceKm <= 550) {
      baseStandard = 7800;
      standardEta = '2 - 3 business days';
      expressDelta = 3000;
      expressEta = '1 - 2 business days';
    } else {
      baseStandard = 9800;
      standardEta = '2 - 4 business days';
      expressDelta = 3500;
      expressEta = '1 - 2 business days';
    }
  } else if (isLagos) {
    baseStandard = 3000;
    standardEta = 'Same day / Next day';
    expressDelta = 2000;
    expressEta = 'Same day express';
  } else if (isSouthWest) {
    baseStandard = 5500;
    standardEta = '1 - 2 business days';
    expressDelta = 2500;
    expressEta = '1 business day';
  } else if (isSouthSouthOrSouthEast) {
    baseStandard = 7500;
    standardEta = '2 - 3 business days';
    expressDelta = 3000;
    expressEta = '1 - 2 business days';
  } else if (isAbujaOrNorth) {
    baseStandard = 9000;
    standardEta = '2 - 4 business days';
    expressDelta = 3500;
    expressEta = '1 - 2 business days';
  }

  const standardFee = Math.round((baseStandard * weightMultiplier) / 100) * 100;
  const expressFee = Math.round(((baseStandard + expressDelta) * weightMultiplier) / 100) * 100;

  return [
    {
      id: 'gig-standard',
      courierName: 'GIG Logistics',
      serviceName: 'Standard Nationwide Dispatch',
      fee: standardFee,
      eta: standardEta,
      isFallback: true,
    },
    {
      id: 'dhl-express',
      courierName: 'DHL Express Nigeria',
      serviceName: 'Priority Courier',
      fee: expressFee,
      eta: expressEta,
      isFallback: true,
    },
    {
      id: 'redstar-standard',
      courierName: 'Red Star Express',
      serviceName: 'Nationwide Delivery',
      fee: Math.round(((baseStandard + 1200) * weightMultiplier) / 100) * 100,
      eta: standardEta,
      isFallback: true,
    },
  ];
};

const fetchSendboxQuotes = async ({ destinationAddress, state, city, area, weightKg, lat, lon }) => {
  const apiKey = (process.env.SENDBOX_API_KEY || '').trim();
  const baseUrl = (process.env.SENDBOX_BASE_URL || 'https://live.sendbox.co').trim().replace(/\/+$/, '');
  const cleanWeight = Math.max(0.5, Number(weightKg) || DEFAULT_BAG_WEIGHT_KG);

  const fullDestination = [destinationAddress, area, city, state, 'Nigeria']
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ');

  if (!apiKey) {
    return {
      quotes: buildFallbackNigeriaQuotes({
        destinationAddress,
        city,
        area,
        state,
        weightKg: cleanWeight,
        lat,
        lon,
      }),
      source: 'estimated_fallback',
    };
  }

  try {
    const payload = {
      origin_name: 'Single Choice',
      origin_street_address: PICKUP_CONFIG.address,
      origin_city: PICKUP_CONFIG.city,
      origin_state: PICKUP_CONFIG.state,
      origin_country: PICKUP_CONFIG.country,
      destination_name: 'Customer Delivery',
      destination_street_address: fullDestination,
      destination_city: (city || area || state || 'Lagos').trim(),
      destination_state: (state || 'Lagos').trim(),
      destination_country: 'Nigeria',
      ...(typeof lat === 'number' && !Number.isNaN(lat) ? { destination_lat: lat } : {}),
      ...(typeof lon === 'number' && !Number.isNaN(lon) ? { destination_lon: lon } : {}),
      weight: cleanWeight,
      weight_unit: 'kg',
      items: [
        {
          name: 'Luxury Handbag',
          quantity: Math.max(1, Math.round(cleanWeight / DEFAULT_BAG_WEIGHT_KG)),
          weight: cleanWeight,
          weight_unit: 'kg',
        },
      ],
    };

    const response = await axios.post(`${baseUrl}/api/v1/merchant/shipments/delivery_quote`, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 12000,
    });

    const rawList =
      response.data?.rates ||
      response.data?.quotes ||
      response.data?.data?.rates ||
      response.data?.data?.quotes ||
      (Array.isArray(response.data?.data) ? response.data.data : []);

    const normalizedQuotes = (Array.isArray(rawList) ? rawList : [])
      .map((q, index) => {
        const rawFee =
          q?.fee ?? q?.amount ?? q?.total ?? q?.delivery_fee ?? q?.rate ?? q?.price ?? null;
        const numericFee = Number(rawFee);
        if (!Number.isFinite(numericFee) || numericFee <= 0) return null;

        const courierName =
          q?.courier_name ||
          q?.courier?.name ||
          q?.carrier_name ||
          q?.name ||
          `Courier Option ${index + 1}`;
        const serviceName = q?.service_name || q?.service_type || q?.mode || 'Courier Delivery';
        const eta =
          q?.eta ||
          q?.delivery_time ||
          q?.duration ||
          q?.estimated_delivery ||
          '1 - 4 business days';

        return {
          id: String(q?.id || q?.quote_id || q?.service_code || `${courierName}-${index}`),
          courierName: String(courierName).trim(),
          serviceName: String(serviceName).trim(),
          fee: Math.round(numericFee),
          eta: String(eta).trim(),
          raw: q,
        };
      })
      .filter(Boolean);

    if (normalizedQuotes.length > 0) {
      normalizedQuotes.sort((a, b) => a.fee - b.fee);
      return {
        quotes: normalizedQuotes,
        source: 'sendbox_live',
      };
    }

    return {
      quotes: buildFallbackNigeriaQuotes({
        destinationAddress,
        city,
        area,
        state,
        weightKg: cleanWeight,
        lat,
        lon,
      }),
      source: 'estimated_fallback',
    };
  } catch (err) {
    console.warn('Sendbox rate lookup fallback triggered:', err.response?.data || err.message);
    return {
      quotes: buildFallbackNigeriaQuotes({
        destinationAddress,
        city,
        area,
        state,
        weightKg: cleanWeight,
        lat,
        lon,
      }),
      source: 'estimated_fallback',
    };
  }
};

const fulfillPaidOrder = async (reference) => {
  if (!reference) return null;

  const existingOrder = await Order.findOne({ paystackReference: reference });
  if (!existingOrder) return null;
  if (existingOrder.paymentStatus === 'paid' && existingOrder.fulfilledAt) {
    return existingOrder;
  }

  const confirmedOrder = await Order.findOneAndUpdate(
    {
      paystackReference: reference,
      $or: [{ paymentStatus: { $ne: 'paid' } }, { fulfilledAt: null }],
    },
    {
      $set: {
        paymentStatus: 'paid',
        fulfilledAt: existingOrder.fulfilledAt || new Date(),
      },
    },
    { new: true }
  );

  if (!confirmedOrder) {
    return Order.findOne({ paystackReference: reference });
  }

  const user = await User.findById(confirmedOrder.customer);

  for (const item of confirmedOrder.items || []) {
    const qtyToDeduct = Math.max(1, Number(item.qty || 1));
    const bag = item.bagId
      ? await Bag.findById(item.bagId)
      : item.bagName
      ? await Bag.findOne({ name: item.bagName })
      : null;

    if (!bag) continue;

    const primaryColor = (bag.colorName || 'Classic').trim().toLowerCase();
    const chosenColor = (item.selectedColor || bag.colorName || 'Classic').trim().toLowerCase();

    if (chosenColor === primaryColor) {
      await Bag.updateOne(
        { _id: bag._id, stock: { $gte: qtyToDeduct } },
        { $inc: { stock: -qtyToDeduct } }
      );
      const currentBag = await Bag.findById(bag._id);
      if (currentBag && Number(currentBag.stock ?? 0) < qtyToDeduct) {
        currentBag.stock = 0;
        await currentBag.save();
      }
    } else {
      const variantIndex = (bag.variants || []).findIndex(
        (v) => (v.colorName || '').trim().toLowerCase() === chosenColor
      );
      if (variantIndex > -1) {
        const updatedVariant = await Bag.findOneAndUpdate(
          {
            _id: bag._id,
            [`variants.${variantIndex}.stock`]: { $gte: qtyToDeduct },
          },
          { $inc: { [`variants.${variantIndex}.stock`]: -qtyToDeduct } },
          { new: true }
        );
        if (!updatedVariant) {
          bag.variants[variantIndex].stock = 0;
          await bag.save();
        }
      } else {
        await Bag.updateOne(
          { _id: bag._id, stock: { $gte: qtyToDeduct } },
          { $inc: { stock: -qtyToDeduct } }
        );
      }
    }

    const refreshedBag = await Bag.findById(bag._id);
    if (refreshedBag) {
      const totalRemaining =
        Number(refreshedBag.stock ?? 0) +
        (refreshedBag.variants || []).reduce((sum, v) => sum + Number(v.stock ?? 0), 0);
      refreshedBag.inStock = totalRemaining > 0;
      await refreshedBag.save();
    }
  }

  if (user && Array.isArray(user.cart) && user.cart.length > 0) {
    user.cart = [];
    await user.save();
  }

  if (user) {
    await sendOrderEmails(confirmedOrder, user, 'paid').catch(() => {});
  }

  return confirmedOrder;
};

// Paystack Webhook Endpoint (must use express.raw before express.json)
app.post(
  '/api/webhooks/paystack',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const secret = (process.env.PAYSTACK_SECRET_KEY || '').trim();
      const signature = req.headers['x-paystack-signature'];

      if (!secret) {
        console.warn('PAYSTACK_SECRET_KEY not set; ignoring Paystack webhook.');
        return res.status(200).json({ received: true });
      }

      if (!signature || typeof signature !== 'string') {
        return res.status(401).json({ message: 'Missing Paystack signature.' });
      }

      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
      const expectedHash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(expectedHash, 'utf8');
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return res.status(401).json({ message: 'Invalid Paystack webhook signature.' });
      }

      const event = JSON.parse(rawBody.toString('utf8'));
      const reference = event?.data?.reference;

      if (event?.event === 'charge.success' && reference) {
        await fulfillPaidOrder(String(reference));
      } else if (event?.event === 'charge.failed' && reference) {
        await Order.findOneAndUpdate(
          { paystackReference: String(reference), paymentStatus: 'pending' },
          { $set: { paymentStatus: 'failed' } }
        );
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('Paystack webhook error:', err.message);
      return res.status(500).json({ message: 'Webhook processing error.' });
    }
  }
);

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Single Choice API' });
});

app.post('/api/webhooks/sendbox', (req, res) => {
  console.log('Sendbox webhook event received:', req.body);
  res.status(200).json({ received: true });
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

// Admin Worker Management Routes
app.get('/api/admin/workers', protect, adminOnly, async (req, res) => {
  try {
    const workers = await User.find({ role: { $in: ['worker', 'staff', 'admin'] } })
      .select('name email role isActive createdAt')
      .sort({ createdAt: -1 });
    res.json({ workers });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not load workers.' });
  }
});

app.post('/api/admin/workers', protect, adminOnly, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = req.body?.role === 'admin' ? 'admin' : 'staff';
    const rawPassword = String(req.body?.password || '');

    if (!email) {
      return res.status(400).json({ message: 'Worker email is required.' });
    }

    const generatedPassword = rawPassword || `${Math.random().toString(36).slice(-8)}A1!`;
    let worker = await User.findOne({ email });
    const isNewAccount = !worker;

    if (worker) {
      worker.role = role;
      worker.isActive = true;
      worker.isVerified = true;
      if (name) worker.name = name;
      if (rawPassword) {
        worker.password = await bcrypt.hash(rawPassword, 10);
      }
      await worker.save();
    } else {
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);
      worker = await User.create({
        name: name || email.split('@')[0],
        email,
        password: hashedPassword,
        role,
        isActive: true,
        isVerified: true,
      });
    }

    setImmediate(() => {
      sendBrevoEmail({
        toEmail: worker.email,
        toName: worker.name,
        subject: 'Your Single Choice Staff Portal Access',
        textContent: `Hi ${worker.name},\n\nYou have been granted ${role} access to the Single Choice portal at https://www.singlechoice.ng.\n\nEmail: ${worker.email}${
          rawPassword || isNewAccount ? `\nPassword: ${generatedPassword}` : ''
        }\n\nPlease sign in with your credentials.`,
      }).catch((err) => console.error('Worker welcome email error:', err.message));
    });

    res.status(201).json({
      worker: {
        _id: worker._id,
        name: worker.name,
        email: worker.email,
        role: worker.role,
        isActive: worker.isActive,
      },
    });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Could not add worker.' });
  }
});

app.delete('/api/admin/workers/:id', protect, adminOnly, async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: 'Worker not found.' });
    }

    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot revoke your own admin access.' });
    }

    target.role = 'customer';
    target.tokenVersion = (target.tokenVersion || 0) + 1;
    await target.save();

    res.json({
      message: 'Worker access revoked.',
      worker: {
        _id: target._id,
        name: target.name,
        email: target.email,
        role: target.role,
        isActive: target.isActive,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not revoke worker access.' });
  }
});

// Staff & Admin Order Fulfillment Routes (#4)
app.get('/api/admin/orders', protect, staffOnly, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('customer', 'name email')
      .sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not load orders.' });
  }
});

app.patch('/api/admin/orders/:id/status', protect, staffOnly, async (req, res) => {
  try {
    const nextStatus = String(req.body?.fulfillmentStatus || '').trim().toLowerCase();
    const trackingNumber =
      req.body?.trackingNumber !== undefined ? String(req.body.trackingNumber).trim() : undefined;

    if (!ALLOWED_FULFILLMENT_STATUSES.includes(nextStatus)) {
      return res.status(400).json({ message: 'Invalid fulfillment status.' });
    }

    const order = await Order.findById(req.params.id).populate('customer', 'name email');
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    order.fulfillmentStatus = nextStatus;
    if (trackingNumber !== undefined) {
      order.trackingNumber = trackingNumber;
    }
    if (nextStatus === 'dispatched' && !order.dispatchedAt) {
      order.dispatchedAt = new Date();
    }
    if (nextStatus === 'delivered' && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }

    await order.save();
    await sendCustomerFulfillmentEmail(order, order.customer).catch(() => {});

    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not update order status.' });
  }
});

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
    const { name, category, price, stock, description, colorName, colorHex, variantsJson } = req.body;
    const primaryFiles = (req.files || []).filter((f) => f.fieldname === 'imageFiles');
    if (primaryFiles.length === 0) {
      return res.status(400).json({ message: 'Please select at least 1 photo.' });
    }

    let variants = [];
    if (variantsJson) {
      const parsed = JSON.parse(variantsJson);
      if (Array.isArray(parsed)) {
        variants = parsed
          .filter((v) => v && (v.colorName || '').trim())
          .map((v, idx) => {
            const vFiles = (req.files || []).filter((f) => f.fieldname === `variantFiles_${idx}`);
            const vUrls =
              vFiles.length > 0
                ? vFiles.map((f) => f.path)
                : Array.isArray(v.images)
                ? v.images
                : v.image
                ? [v.image]
                : [];
            return {
              colorName: v.colorName.trim(),
              colorHex: v.colorHex || '#142B22',
              stock: Math.max(0, Number(v.stock ?? 1)),
              image: vUrls[0] || '',
              images: vUrls,
            };
          });
      }
    }

    const primaryImageUrls = primaryFiles.map((f) => f.path);
    const numStock = Math.max(0, Number(stock ?? 1));
    const totalRemaining =
      numStock + variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);

    const bag = await Bag.create({
      name: (name || '').trim(),
      category: (category || '').trim(),
      price: Number(price),
      stock: numStock,
      description: description || '',
      colorName: (colorName || 'Classic').trim(),
      colorHex: colorHex || '#142B22',
      image: primaryImageUrls[0],
      images: primaryImageUrls,
      variants,
      inStock: totalRemaining > 0,
    });
    res.status(201).json(bag);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.put('/api/bags/:id', protect, staffOnly, upload.any(), async (req, res) => {
  try {
    const bag = await Bag.findById(req.params.id);
    if (!bag) {
      return res.status(404).json({ message: 'Handbag not found.' });
    }

    const { name, category, price, stock, description, colorName, colorHex, variantsJson } = req.body;

    if (name !== undefined && String(name).trim()) {
      bag.name = String(name).trim();
    }
    if (category !== undefined && String(category).trim()) {
      bag.category = String(category).trim();
    }
    if (price !== undefined && price !== '') {
      bag.price = Number(price);
    }
    if (stock !== undefined && stock !== '') {
      bag.stock = Math.max(0, Number(stock));
    }
    if (description !== undefined) {
      bag.description = description;
    }
    if (colorName !== undefined && String(colorName).trim()) {
      bag.colorName = String(colorName).trim();
    }
    if (colorHex !== undefined && String(colorHex).trim()) {
      bag.colorHex = String(colorHex).trim();
    }

    const primaryFiles = (req.files || []).filter((f) => f.fieldname === 'imageFiles');
    if (primaryFiles.length > 0) {
      const uploadedUrls = primaryFiles.map((f) => f.path);
      bag.image = uploadedUrls[0];
      bag.images = uploadedUrls;
    }

    if (variantsJson !== undefined) {
      const parsedVariants = JSON.parse(variantsJson);
      if (Array.isArray(parsedVariants)) {
        bag.variants = parsedVariants
          .filter((v) => v && (v.colorName || '').trim())
          .map((v, idx) => {
            const vFiles = (req.files || []).filter((f) => f.fieldname === `variantFiles_${idx}`);
            const vUrls =
              vFiles.length > 0
                ? vFiles.map((f) => f.path)
                : Array.isArray(v.images)
                ? v.images
                : v.image
                ? [v.image]
                : [];
            return {
              colorName: v.colorName.trim(),
              colorHex: v.colorHex || '#142B22',
              stock: Math.max(0, Number(v.stock ?? 1)),
              image: vUrls[0] || '',
              images: vUrls,
            };
          });
      }
    }

    const totalRemaining =
      Number(bag.stock ?? 0) +
      (bag.variants || []).reduce((sum, v) => sum + Number(v.stock ?? 0), 0);
    bag.inStock = totalRemaining > 0;

    await bag.save();
    res.json(bag);
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
  try {
    const { bagId, qty = 1, selectedColor } = req.body;
    const delta = Number(qty);
    if (!Number.isInteger(delta) || delta === 0) {
      return res.status(400).json({ message: 'Invalid quantity.' });
    }

    const bag = await Bag.findById(bagId);
    if (!bag) return res.status(404).json({ message: 'Bag not found.' });

    const colorToUse = (selectedColor || bag.colorName || 'Classic').trim();
    const availableStock = getAvailableStockForColor(bag, colorToUse);

    if (delta > 0 && availableStock <= 0) {
      return res.status(400).json({
        message: `${bag.name} (${colorToUse}) is currently sold out.`,
      });
    }

    const user = await User.findById(req.user._id);
    const existingIdx = user.cart.findIndex(
      (item) =>
        item.bag.toString() === String(bagId) &&
        (item.selectedColor || bag.colorName || 'Classic').toLowerCase() === colorToUse.toLowerCase()
    );

    if (existingIdx > -1) {
      const nextQty = Number(user.cart[existingIdx].qty || 0) + delta;
      if (nextQty <= 0) {
        user.cart.splice(existingIdx, 1);
      } else if (nextQty > availableStock) {
        return res.status(400).json({
          message: `Only ${availableStock} ${availableStock === 1 ? 'piece' : 'pieces'} of ${bag.name} (${colorToUse}) available in stock.`,
        });
      } else {
        user.cart[existingIdx].qty = nextQty;
      }
    } else if (delta > 0) {
      if (delta > availableStock) {
        return res.status(400).json({
          message: `Only ${availableStock} ${availableStock === 1 ? 'piece' : 'pieces'} of ${bag.name} (${colorToUse}) available in stock.`,
        });
      }
      user.cart.push({ bag: bagId, qty: delta, selectedColor: colorToUse });
    }

    await user.save();
    const updated = await User.findById(req.user._id).populate('cart.bag');
    res.json(updated.cart.filter((item) => item.bag !== null));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Could not update bag.' });
  }
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

// Live Nationwide Sendbox Courier Rate Shopping
app.post('/api/shipping/rates', protect, customerOnly, async (req, res) => {
  try {
    const { destinationAddress, state, city, area, weightKg, lat, lon } = req.body;
    if (!String(destinationAddress || area || city || state || '').trim()) {
      return res.status(400).json({ message: 'Please enter a destination location in Nigeria.' });
    }

    const user = await User.findById(req.user._id).populate('cart.bag');
    const validItems = (user?.cart || []).filter((i) => i.bag !== null);
    const totalItemQty = validItems.reduce((sum, i) => sum + Number(i.qty || 1), 0);
    const calculatedWeightKg =
      Number(weightKg) > 0
        ? Number(weightKg)
        : Math.max(DEFAULT_BAG_WEIGHT_KG, totalItemQty * DEFAULT_BAG_WEIGHT_KG);

    const result = await fetchSendboxQuotes({
      destinationAddress,
      state,
      city,
      area,
      weightKg: calculatedWeightKg,
      lat,
      lon,
    });

    res.json({
      pickup: PICKUP_CONFIG,
      weightKg: calculatedWeightKg,
      source: result.source,
      quotes: result.quotes,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to fetch shipping quotes.' });
  }
});

app.post('/api/checkout/initialize', protect, customerOnly, async (req, res) => {
  try {
    const {
      area,
      city,
      state,
      streetAddress,
      phone,
      selectedCourier,
      lat,
      lon,
    } = req.body;

    const cleanStreetAddress = String(streetAddress || '').trim();
    const cleanPhone = String(phone || '').trim();
    if (!cleanStreetAddress) {
      return res.status(400).json({ message: 'Please enter your delivery street address.' });
    }
    if (!cleanPhone) {
      return res.status(400).json({ message: 'Please enter a recipient phone number.' });
    }

    const user = await User.findById(req.user._id).populate('cart.bag');
    const validItems = user.cart.filter((i) => i.bag !== null);
    if (validItems.length === 0) return res.status(400).json({ message: 'Cart is empty.' });

    for (const item of validItems) {
      const chosenColor = (item.selectedColor || item.bag.colorName || 'Classic').trim();
      const availableStock = getAvailableStockForColor(item.bag, chosenColor);
      const requestedQty = Math.max(1, Number(item.qty || 1));
      if (availableStock < requestedQty) {
        return res.status(400).json({
          message:
            availableStock <= 0
              ? `${item.bag.name} (${chosenColor}) is now sold out. Please remove it from your bag to continue.`
              : `Only ${availableStock} left for ${item.bag.name} (${chosenColor}), but your bag has ${requestedQty}.`,
        });
      }
    }

    const totalItemQty = validItems.reduce((sum, i) => sum + Number(i.qty || 1), 0);
    const weightKg = Math.max(DEFAULT_BAG_WEIGHT_KG, totalItemQty * DEFAULT_BAG_WEIGHT_KG);

    const quoteResult = await fetchSendboxQuotes({
      destinationAddress: cleanStreetAddress,
      state: state || area,
      city: city || area,
      area: area || city || state || 'Nigeria',
      weightKg,
      lat,
      lon,
    });

    const quotes = quoteResult.quotes;
    const matchedQuote =
      quotes.find(
        (q) =>
          (selectedCourier?.id && q.id === selectedCourier.id) ||
          (selectedCourier?.courierName &&
            q.courierName.toLowerCase() === String(selectedCourier.courierName).toLowerCase())
      ) || quotes[0];

    const subtotal = validItems.reduce((sum, i) => sum + Number(i.bag.price || 0) * Number(i.qty || 1), 0);
    const deliveryFee = matchedQuote ? Math.max(0, Number(matchedQuote.fee || 0)) : 0;
    const courierName = matchedQuote?.courierName || selectedCourier?.courierName || 'Standard Dispatch';
    const courierEta = matchedQuote?.eta || selectedCourier?.eta || '';
    const totalAmount = subtotal + deliveryFee;

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({ message: 'Invalid order total amount.' });
    }

    const reference = 'SC_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const formattedArea = [area, city, state].filter(Boolean).join(', ') || 'Nigeria';

    const createdOrder = await Order.create({
      customer: user._id,
      items: validItems.map((i) => {
        const chosenColor = i.selectedColor || i.bag.colorName || 'Classic';
        const matchedVariant = (i.bag.variants || []).find(
          (v) => (v.colorName || '').toLowerCase() === chosenColor.toLowerCase()
        );
        const itemImage =
          matchedVariant?.image ||
          matchedVariant?.images?.[0] ||
          i.bag.image ||
          i.bag.images?.[0] ||
          '';

        return {
          bagId: i.bag._id,
          bagName: i.bag.name,
          selectedColor: chosenColor,
          name: `${i.bag.name} (${chosenColor})`,
          price: i.bag.price,
          qty: i.qty,
          image: itemImage,
        };
      }),
      delivery: {
        city: (city || state || 'Lagos').trim(),
        area: formattedArea,
        streetAddress: cleanStreetAddress,
        phone: cleanPhone,
        fee: deliveryFee,
        courierName,
        eta: courierEta,
        weightKg,
      },
      subtotal,
      deliveryFee,
      totalAmount,
      paystackReference: reference,
    });

    await sendOrderEmails(createdOrder, user, 'placed');

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.json({
        authorization_url: '#',
        reference,
        subtotal,
        deliveryFee,
        courierName,
        totalAmount,
      });
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
      courierName,
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