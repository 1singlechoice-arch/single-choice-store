export const customerOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication required.',
    });
  }

  if (req.user.role === 'admin' || req.user.role === 'staff') {
    return res.status(403).json({
      message: 'Admin and staff accounts cannot place orders. Please use a customer account.',
    });
  }

  return next();
};

export default customerOnly;