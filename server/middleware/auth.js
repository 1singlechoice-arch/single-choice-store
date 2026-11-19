import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Please log in to continue.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'Account not found.' });
    }

    if (!user.isActive || user.tokenVersion !== decoded.tokenVersion) {
      return res.status(403).json({
        message: 'Your session has been revoked by the Admin. Access denied.',
        forceLogout: true,
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Session expired. Please log in again.' });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required.' });
  }
  next();
};

export const staffOnly = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'worker') {
    return res.status(403).json({ message: 'Staff access required.' });
  }
  next();
};