import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ShoppingBag,
  User,
  Menu,
  X,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Search,
  Volume2,
  VolumeX,
  Home,
  Sparkles,
  Phone,
  Mail,
  MessageCircle,
  Truck,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
} from 'lucide-react';
import StaffPortal from './components/StaffPortal';
import { apiRequest, resolveBagImage } from './utils/api';

const NIGERIA_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau',
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

const SAVED_ITEMS_STORAGE_KEY = 'single_choice_saved_items_v1';

const getBagPrimaryColor = (bag) => (bag?.colorName || 'Classic').trim();

const getBagColorOptions = (bag) => {
  if (!bag) return [];
  const options = [];
  const primaryColor = getBagPrimaryColor(bag);
  const primaryImages = Array.isArray(bag.images) && bag.images.length > 0
    ? bag.images
    : bag.image
    ? [bag.image]
    : [];

  options.push({
    colorName: primaryColor,
    colorHex: bag.colorHex || '#142B22',
    stock: Math.max(0, Number(bag.stock ?? 0)),
    images: primaryImages,
    isPrimary: true,
  });

  if (Array.isArray(bag.variants)) {
    bag.variants.forEach((v) => {
      if (!v || !(v.colorName || '').trim()) return;
      const vColor = v.colorName.trim();
      if (options.some((opt) => opt.colorName.toLowerCase() === vColor.toLowerCase())) return;
      const vImages = Array.isArray(v.images) && v.images.length > 0
        ? v.images
        : v.image
        ? [v.image]
        : primaryImages;
      options.push({
        colorName: vColor,
        colorHex: v.colorHex || '#6E2639',
        stock: Math.max(0, Number(v.stock ?? 0)),
        images: vImages,
        isPrimary: false,
      });
    });
  }

  return options;
};

const getBagColorStock = (bag, colorName) => {
  const options = getBagColorOptions(bag);
  if (options.length === 0) return Math.max(0, Number(bag?.stock ?? 0));
  const target = (colorName || getBagPrimaryColor(bag)).trim().toLowerCase();
  const match = options.find((opt) => opt.colorName.toLowerCase() === target);
  return match ? match.stock : options[0].stock;
};

const getBagTotalStock = (bag) => {
  if (!bag) return 0;
  const options = getBagColorOptions(bag);
  if (options.length > 0) {
    return options.reduce((sum, opt) => sum + Math.max(0, Number(opt.stock || 0)), 0);
  }
  return Math.max(0, Number(bag.stock ?? 0));
};

const getBagImagesForColor = (bag, colorName) => {
  if (!bag) return [];
  const options = getBagColorOptions(bag);
  const target = (colorName || getBagPrimaryColor(bag)).trim().toLowerCase();
  const matched = options.find((opt) => opt.colorName.toLowerCase() === target);
  const chosenImages = matched?.images?.length
    ? matched.images
    : Array.isArray(bag.images) && bag.images.length > 0
    ? bag.images
    : bag.image
    ? [bag.image]
    : [];

  return chosenImages
    .filter(Boolean)
    .filter((url, idx, arr) => arr.indexOf(url) === idx);
};

function BagDetailModal({
  bag,
  initialColor,
  onClose,
  onAddToBag,
  isSaved,
  onToggleSave,
}) {
  const colorOptions = useMemo(() => getBagColorOptions(bag), [bag]);
  const [selectedColor, setSelectedColor] = useState(() => {
    if (initialColor && colorOptions.some((c) => c.colorName.toLowerCase() === initialColor.toLowerCase())) {
      const found = colorOptions.find((c) => c.colorName.toLowerCase() === initialColor.toLowerCase());
      return found.colorName;
    }
    return colorOptions[0]?.colorName || 'Classic';
  });
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!bag) return;
    const opts = getBagColorOptions(bag);
    if (initialColor && opts.some((c) => c.colorName.toLowerCase() === initialColor.toLowerCase())) {
      const found = opts.find((c) => c.colorName.toLowerCase() === initialColor.toLowerCase());
      setSelectedColor(found.colorName);
    } else {
      setSelectedColor(opts[0]?.colorName || 'Classic');
    }
    setActivePhotoIdx(0);
  }, [bag, initialColor]);

  const galleryUrls = useMemo(() => {
    const urls = getBagImagesForColor(bag, selectedColor);
    return urls.length > 0 ? urls.map((u) => resolveBagImage(u)) : [resolveBagImage('')];
  }, [bag, selectedColor]);

  useEffect(() => {
    if (activePhotoIdx >= galleryUrls.length) {
      setActivePhotoIdx(0);
    }
  }, [galleryUrls.length, activePhotoIdx]);

  if (!bag) return null;

  const activeColorStock = getBagColorStock(bag, selectedColor);
  const activeColorObj = colorOptions.find(
    (c) => c.colorName.toLowerCase() === selectedColor.toLowerCase()
  );
  const bagSaved = typeof isSaved === 'function' ? isSaved(bag._id, selectedColor) : false;

  const handlePrevPhoto = (e) => {
    e.stopPropagation();
    setActivePhotoIdx((prev) => (prev - 1 + galleryUrls.length) % galleryUrls.length);
  };

  const handleNextPhoto = (e) => {
    e.stopPropagation();
    setActivePhotoIdx((prev) => (prev + 1) % galleryUrls.length);
  };

  const handleAdd = async () => {
    if (activeColorStock <= 0 || adding) return;
    setAdding(true);
    try {
      await onAddToBag(bag, 1, selectedColor);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={bag.name}
    >
      <div
        className="bag-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close-btn bag-detail-close"
          onClick={onClose}
          aria-label="Close bag details"
        >
          <X size={20} />
        </button>

        <div className="bag-detail-grid">
          <div className="bag-detail-gallery">
            <div className="bag-detail-stage">
              <img
                src={galleryUrls[activePhotoIdx]}
                alt={`${bag.name} - ${selectedColor} view ${activePhotoIdx + 1}`}
                className="bag-detail-main-img"
              />

              {galleryUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    className="bag-gallery-arrow prev"
                    onClick={handlePrevPhoto}
                    aria-label="Previous photo"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    className="bag-gallery-arrow next"
                    onClick={handleNextPhoto}
                    aria-label="Next photo"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
            </div>

            {galleryUrls.length > 1 && (
              <div className="bag-detail-thumbs">
                {galleryUrls.map((src, idx) => (
                  <button
                    key={`${src}-${idx}`}
                    type="button"
                    className={`bag-thumb-btn ${idx === activePhotoIdx ? 'active' : ''}`}
                    onClick={() => setActivePhotoIdx(idx)}
                    aria-label={`View photo ${idx + 1}`}
                  >
                    <img src={src} alt={`Thumbnail ${idx + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bag-detail-info">
            <span className="eyebrow-gold">{bag.category || 'SINGLE CHOICE EDITION'}</span>
            <h2 className="bag-detail-title">{bag.name}</h2>
            <div className="bag-detail-price">₦{Number(bag.price || 0).toLocaleString()}</div>

            <div className="bag-detail-stock-row">
              {activeColorStock > 0 ? (
                <span className="stock-badge in-stock">
                  {activeColorStock} {activeColorStock === 1 ? 'piece' : 'pieces'} available in {selectedColor}
                </span>
              ) : (
                <span className="stock-badge sold-out">
                  Sold out in {selectedColor}
                </span>
              )}
            </div>

            {colorOptions.length > 0 && (
              <div className="bag-detail-colors">
                <span className="bag-detail-label">
                  Color: <strong>{selectedColor}</strong>
                </span>
                <div className="bag-swatch-row">
                  {colorOptions.map((opt) => {
                    const isSelected = opt.colorName.toLowerCase() === selectedColor.toLowerCase();
                    return (
                      <button
                        key={opt.colorName}
                        type="button"
                        className={`bag-swatch-chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedColor(opt.colorName);
                          setActivePhotoIdx(0);
                        }}
                      >
                        <span
                          className="bag-swatch-dot"
                          style={{ backgroundColor: opt.colorHex || '#142B22' }}
                        />
                        <span>{opt.colorName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {bag.description && (
              <p className="bag-detail-description">{bag.description}</p>
            )}

            <div className="bag-detail-actions">
              <button
                type="button"
                className="btn-primary full-width"
                disabled={activeColorStock <= 0 || adding}
                onClick={handleAdd}
              >
                {activeColorStock <= 0
                  ? 'Sold Out'
                  : adding
                  ? 'Adding to Bag...'
                  : `Add to Bag${activeColorObj ? ` — ${activeColorObj.colorName}` : ''}`}
              </button>

              {typeof onToggleSave === 'function' && (
                <button
                  type="button"
                  className={`btn-secondary full-width bag-save-btn ${bagSaved ? 'saved' : ''}`}
                  onClick={() => onToggleSave(bag, selectedColor)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Heart size={16} fill={bagSaved ? 'currentColor' : 'none'} />
                  {bagSaved ? 'Saved in Wishlist' : 'Save Item'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sc_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('sc_token') || '');

  const [view, setView] = useState('home'); // 'home' | 'shop' | 'orders' | 'saved' | 'admin'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [bags, setBags] = useState([]);
  const [collections, setCollections] = useState([]);
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [savedItems, setSavedItems] = useState(() => {
    try {
      const raw = localStorage.getItem(SAVED_ITEMS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [loadingBags, setLoadingBags] = useState(true);

  const [activeBagModal, setActiveBagModal] = useState(null);

  const [heroImage, setHeroImage] = useState('');
  const [heroVideo, setHeroVideo] = useState('');
  const [heroEyebrow, setHeroEyebrow] = useState('SINGLE CHOICE • CAMPAIGN 2026');
  const [heroTitle, setHeroTitle] = useState('The Art of Carrying');
  const [heroSubtitle, setHeroSubtitle] = useState(
    'Curated designer silhouettes crafted for timeless presence. Explore every angle, swatch, and limited release.'
  );
  const [heroCtaText, setHeroCtaText] = useState('Discover the Collection');
  const [isMuted, setIsMuted] = useState(true);
  const heroVideoRef = useRef(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'otp' | 'forgot' | 'reset'
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNewPassword, setAuthNewPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [deliveryState, setDeliveryState] = useState('Lagos');
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryArea, setDeliveryArea] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [loadingAddressSuggestions, setLoadingAddressSuggestions] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [shippingQuotes, setShippingQuotes] = useState([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [loadingRates, setLoadingRates] = useState(false);
  const [rateError, setRateError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const [contactOpen, setContactOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [sendingContact, setSendingContact] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3600);
  }, []);

  const handleForceLogout = useCallback(() => {
    localStorage.removeItem('sc_token');
    localStorage.removeItem('sc_user');
    setToken('');
    setUser(null);
    setCart([]);
    setOrders([]);
    setView((prev) => (prev === 'admin' || prev === 'orders' ? 'home' : prev));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_ITEMS_STORAGE_KEY, JSON.stringify(savedItems));
    } catch {
      // Ignore storage quota errors
    }
  }, [savedItems]);

  const isItemSaved = useCallback(
    (bagId, colorName = '') => {
      if (!bagId) return false;
      const targetColor = String(colorName || '').trim().toLowerCase();
      return savedItems.some((item) => {
        const sameBag = String(item.bagId) === String(bagId);
        if (!targetColor) return sameBag;
        return sameBag && String(item.selectedColor || '').trim().toLowerCase() === targetColor;
      });
    },
    [savedItems]
  );

  const handleToggleSaveItem = useCallback(
    (bag, selectedColor = '') => {
      if (!bag?._id) return;
      const colorToSave = (selectedColor || getBagPrimaryColor(bag) || 'Classic').trim();
      const alreadySaved = savedItems.some(
        (item) =>
          String(item.bagId) === String(bag._id) &&
          String(item.selectedColor || '').trim().toLowerCase() === colorToSave.toLowerCase()
      );

      if (alreadySaved) {
        setSavedItems((prev) =>
          prev.filter(
            (item) =>
              !(
                String(item.bagId) === String(bag._id) &&
                String(item.selectedColor || '').trim().toLowerCase() === colorToSave.toLowerCase()
              )
          )
        );
        showToast(`Removed ${bag.name} (${colorToSave}) from Saved Items.`);
      } else {
        const colorImgs = getBagImagesForColor(bag, colorToSave);
        const snapshot = {
          bagId: bag._id,
          name: bag.name,
          category: bag.category || 'Handbag',
          price: Number(bag.price || 0),
          selectedColor: colorToSave,
          image: colorImgs[0] || bag.image || bag.images?.[0] || '',
          savedAt: new Date().toISOString(),
        };
        setSavedItems((prev) => [snapshot, ...prev]);
        showToast(`Saved ${bag.name} (${colorToSave}) to your wishlist.`);
      }
    },
    [savedItems, showToast]
  );

  const fetchSettings = useCallback(async () => {
    try {
      const data = await apiRequest('/api/settings');
      if (data) {
        setHeroImage(data.heroImage || '');
        setHeroVideo(data.heroVideo || '');
        if (data.heroEyebrow) setHeroEyebrow(data.heroEyebrow);
        if (data.heroTitle) setHeroTitle(data.heroTitle);
        if (data.heroSubtitle) setHeroSubtitle(data.heroSubtitle);
        if (data.heroCtaText) setHeroCtaText(data.heroCtaText);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchBags = useCallback(async () => {
    setLoadingBags(true);
    try {
      const data = await apiRequest('/api/bags');
      setBags(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBags(false);
    }
  }, []);

  const fetchCollections = useCallback(async () => {
    try {
      const data = await apiRequest('/api/collections');
      setCollections(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchCart = useCallback(async () => {
    if (!token || !user || user.role !== 'customer') {
      setCart([]);
      return;
    }
    try {
      const data = await apiRequest('/api/cart', {}, handleForceLogout);
      setCart(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, [token, user, handleForceLogout]);

  const fetchOrders = useCallback(async () => {
    if (!token || !user || user.role !== 'customer') {
      setOrders([]);
      return;
    }
    try {
      const data = await apiRequest('/api/orders/my', {}, handleForceLogout);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, [token, user, handleForceLogout]);

  useEffect(() => {
    fetchSettings();
    fetchBags();
    fetchCollections();
  }, [fetchSettings, fetchBags, fetchCollections]);

  useEffect(() => {
    if (token && user) {
      apiRequest('/api/auth/me', {}, handleForceLogout)
        .then((res) => {
          if (res?.user) {
            const normalized = {
              id: res.user.id || res.user._id,
              name: res.user.name,
              email: res.user.email,
              role: res.user.role,
            };
            setUser(normalized);
            localStorage.setItem('sc_user', JSON.stringify(normalized));
          }
        })
        .catch(() => {});
    }
  }, [token, user?.id, handleForceLogout]);

  useEffect(() => {
    if (token && user?.role === 'customer') {
      fetchCart();
      fetchOrders();
    } else {
      setCart([]);
      setOrders([]);
    }
  }, [token, user?.role, fetchCart, fetchOrders]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (reference && token && user?.role === 'customer') {
      apiRequest(`/api/checkout/verify/${encodeURIComponent(reference)}`, {}, handleForceLogout)
        .then(() => {
          showToast('Payment confirmed! Your order is now being prepared.');
          fetchCart();
          fetchOrders();
          fetchBags();
          setView('orders');
        })
        .catch(() => {})
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, [token, user?.role, showToast, fetchCart, fetchOrders, fetchBags, handleForceLogout]);

  const openAuthModal = (mode = 'login', actionAfterLogin = null) => {
    setAuthMode(mode);
    setAuthError('');
    setPendingAction(() => actionAfterLogin);
    setAuthModalOpen(true);
  };

  const handleAuthSuccess = (authData) => {
    localStorage.setItem('sc_token', authData.token);
    localStorage.setItem('sc_user', JSON.stringify(authData.user));
    setToken(authData.token);
    setUser(authData.user);
    setAuthModalOpen(false);
    setAuthPassword('');
    setAuthNewPassword('');
    setOtpCode('');
    showToast(`Welcome back, ${authData.user.name}!`);

    const nextAction = pendingAction;
    setPendingAction(null);
    if (typeof nextAction === 'function') {
      setTimeout(() => nextAction(authData.user), 120);
    } else if (authData.user.role === 'admin' || authData.user.role === 'staff') {
      setView('admin');
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      handleAuthSuccess(data);
    } catch (err) {
      setAuthError(err.message || 'Invalid credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }),
      });
      setAuthEmail(data.email || authEmail);
      setAuthMode('otp');
      showToast('6-digit verification code sent to your email.');
    } catch (err) {
      setAuthError(err.message || 'Could not create account.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const data = await apiRequest('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: authEmail, otp: otpCode }),
      });
      handleAuthSuccess(data);
    } catch (err) {
      setAuthError(err.message || 'Invalid verification code.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const data = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: authEmail }),
      });
      setAuthEmail(data.email || authEmail);
      setAuthMode('reset');
      showToast('Password reset code sent to your email.');
    } catch (err) {
      setAuthError(err.message || 'Could not send reset code.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const data = await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: authEmail, otp: otpCode, newPassword: authNewPassword }),
      });
      handleAuthSuccess(data);
    } catch (err) {
      setAuthError(err.message || 'Could not reset password.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    handleForceLogout();
    showToast('Signed out.');
  };

  const executeAddToBag = async (bag, qty = 1, colorOverride = null) => {
    const colorToUse = (colorOverride || getBagPrimaryColor(bag) || 'Classic').trim();
    const availableStock = getBagColorStock(bag, colorToUse);
    if (availableStock <= 0) {
      showToast(`${bag.name} (${colorToUse}) is currently sold out.`, 'error');
      return;
    }

    try {
      const updatedCart = await apiRequest(
        '/api/cart',
        {
          method: 'POST',
          body: JSON.stringify({
            bagId: bag._id,
            qty,
            selectedColor: colorToUse,
          }),
        },
        handleForceLogout
      );
      setCart(Array.isArray(updatedCart) ? updatedCart : []);
      showToast(`${bag.name} (${colorToUse}) added to your bag.`);
      setDrawerOpen(true);
    } catch (err) {
      showToast(err.message || 'Could not add item to bag.', 'error');
    }
  };

  const handleAddToBag = async (bag, qty = 1, colorOverride = null) => {
    const colorToUse = (colorOverride || getBagPrimaryColor(bag) || 'Classic').trim();
    if (!token || !user) {
      openAuthModal('login', (authedUser) => {
        if (authedUser.role === 'customer') {
          executeAddToBag(bag, qty, colorToUse);
        } else {
          showToast('Switch to a customer account to add items to a shopping bag.', 'error');
        }
      });
      return;
    }

    if (user.role !== 'customer') {
      showToast('Staff/Admin accounts manage inventory in the portal rather than placing customer bag orders.', 'error');
      return;
    }

    await executeAddToBag(bag, qty, colorToUse);
  };

  const handleUpdateQty = async (item, delta) => {
    if (!item?.bag?._id) return;
    try {
      const updatedCart = await apiRequest(
        '/api/cart',
        {
          method: 'POST',
          body: JSON.stringify({
            bagId: item.bag._id,
            qty: delta,
            selectedColor: item.selectedColor || getBagPrimaryColor(item.bag),
          }),
        },
        handleForceLogout
      );
      setCart(Array.isArray(updatedCart) ? updatedCart : []);
    } catch (err) {
      showToast(err.message || 'Could not update quantity.', 'error');
    }
  };

  const handleRemoveItem = async (item) => {
    if (!item?.bag?._id) return;
    try {
      const colorParam = item.selectedColor
        ? `?color=${encodeURIComponent(item.selectedColor)}`
        : '';
      const updatedCart = await apiRequest(
        `/api/cart/${item.bag._id}${colorParam}`,
        { method: 'DELETE' },
        handleForceLogout
      );
      setCart(Array.isArray(updatedCart) ? updatedCart : []);
    } catch (err) {
      showToast(err.message || 'Could not remove item.', 'error');
    }
  };

  const cartSubtotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.bag?.price || 0) * Number(item.qty || 1),
        0
      ),
    [cart]
  );

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.qty || 1), 0),
    [cart]
  );

  const selectedQuote = useMemo(
    () => shippingQuotes.find((q) => q.id === selectedQuoteId) || shippingQuotes[0] || null,
    [shippingQuotes, selectedQuoteId]
  );

  const activeDeliveryFee = selectedQuote ? Number(selectedQuote.fee || 0) : 0;

  // Geoapify Address Autocomplete
  useEffect(() => {
    if (!checkoutOpen) return;
    const queryText = [streetAddress, deliveryArea, deliveryCity, deliveryState]
      .map((s) => (s || '').trim())
      .filter(Boolean)
      .join(', ');

    if (queryText.length < 4) {
      setAddressSuggestions([]);
      return;
    }

    const apiKey = (import.meta.env.VITE_GEOAPIFY_API_KEY || '').trim();
    if (!apiKey) return;

    const timer = setTimeout(async () => {
      setLoadingAddressSuggestions(true);
      try {
        const res = await fetch(
          `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(
            queryText
          )}&filter=countrycode:ng&limit=5&apiKey=${encodeURIComponent(apiKey)}`
        );
        const data = await res.json();
        const features = Array.isArray(data?.features) ? data.features : [];
        setAddressSuggestions(
          features.map((f, idx) => ({
            id: f.properties?.place_id || `${idx}`,
            label: f.properties?.formatted || '',
            city: f.properties?.city || f.properties?.town || f.properties?.suburb || '',
            state: f.properties?.state || '',
            lat: f.properties?.lat,
            lon: f.properties?.lon,
          }))
        );
      } catch {
        setAddressSuggestions([]);
      } finally {
        setLoadingAddressSuggestions(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [checkoutOpen, streetAddress, deliveryArea, deliveryCity, deliveryState]);

  const handleSelectSuggestion = (s) => {
    setStreetAddress(s.label || streetAddress);
    if (s.city) {
      setDeliveryCity(s.city);
      if (!deliveryArea) setDeliveryArea(s.city);
    }
    if (typeof s.lat === 'number' && typeof s.lon === 'number') {
      setSelectedCoords({ lat: s.lat, lon: s.lon });
    }
    setAddressSuggestions([]);
  };

  const fetchShippingQuotes = useCallback(async () => {
    const destText = [streetAddress, deliveryArea, deliveryCity, deliveryState]
      .map((s) => (s || '').trim())
      .filter(Boolean)
      .join(', ');

    if (!destText) {
      setRateError('Enter a street address or delivery area to calculate shipping rates.');
      return;
    }

    setLoadingRates(true);
    setRateError('');
    try {
      const res = await apiRequest(
        '/api/shipping/rates',
        {
          method: 'POST',
          body: JSON.stringify({
            destinationAddress: streetAddress.trim() || destText,
            state: deliveryState,
            city: deliveryCity.trim() || deliveryArea.trim() || deliveryState,
            area: deliveryArea.trim() || deliveryCity.trim() || deliveryState,
            ...(selectedCoords ? { lat: selectedCoords.lat, lon: selectedCoords.lon } : {}),
          }),
        },
        handleForceLogout
      );
      const quotes = Array.isArray(res?.quotes) ? res.quotes : [];
      setShippingQuotes(quotes);
      if (quotes.length > 0) {
        setSelectedQuoteId((prev) =>
          quotes.some((q) => q.id === prev) ? prev : quotes[0].id
        );
      }
    } catch (err) {
      setRateError(err.message || 'Unable to load shipping rates.');
    } finally {
      setLoadingRates(false);
    }
  }, [streetAddress, deliveryArea, deliveryCity, deliveryState, selectedCoords, handleForceLogout]);

  useEffect(() => {
    if (!checkoutOpen) return;
    const hasDestination =
      streetAddress.trim().length >= 3 ||
      deliveryArea.trim().length >= 2 ||
      deliveryCity.trim().length >= 2;
    if (!hasDestination) return;

    const timer = setTimeout(() => {
      fetchShippingQuotes();
    }, 450);

    return () => clearTimeout(timer);
  }, [checkoutOpen, streetAddress, deliveryArea, deliveryCity, deliveryState, fetchShippingQuotes]);

  const handleOpenCheckout = () => {
    if (!token || !user) {
      openAuthModal('login', () => {
        setDrawerOpen(false);
        setCheckoutOpen(true);
      });
      return;
    }
    setCheckoutError('');
    setRateError('');
    setDrawerOpen(false);
    setCheckoutOpen(true);
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    setCheckoutError('');
    if (!streetAddress.trim() || !phone.trim()) {
      setCheckoutError('Please enter your delivery street address and phone number.');
      return;
    }

    setCheckingOut(true);
    try {
      const payload = {
        state: deliveryState,
        city: deliveryCity.trim() || deliveryArea.trim() || deliveryState,
        area: deliveryArea.trim() || deliveryCity.trim() || deliveryState,
        streetAddress: streetAddress.trim(),
        phone: phone.trim(),
        ...(selectedCoords ? { lat: selectedCoords.lat, lon: selectedCoords.lon } : {}),
        ...(selectedQuote
          ? {
              selectedCourier: {
                id: selectedQuote.id,
                courierName: selectedQuote.courierName,
                fee: selectedQuote.fee,
                eta: selectedQuote.eta,
              },
            }
          : {}),
      };

      const data = await apiRequest(
        '/api/checkout/initialize',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        handleForceLogout
      );

      if (data?.authorization_url && data.authorization_url !== '#') {
        window.location.href = data.authorization_url;
      } else {
        showToast('Order initialized!');
        setCheckoutOpen(false);
        fetchOrders();
      }
    } catch (err) {
      setCheckoutError(err.message || 'Checkout could not be started.');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSendingContact(true);
    try {
      const res = await apiRequest('/api/contact', {
        method: 'POST',
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
          subject: contactSubject,
          message: contactMessage,
        }),
      });
      showToast(res?.message || 'Message sent to Single Choice Concierge.');
      setContactOpen(false);
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setContactSubject('');
      setContactMessage('');
    } catch (err) {
      showToast(err.message || 'Unable to send message right now.', 'error');
    } finally {
      setSendingContact(false);
    }
  };

  const filteredBags = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bags.filter((bag) => {
      const matchesCat =
        selectedCategory === 'All' ||
        String(bag.category || '').toLowerCase() === String(selectedCategory).toLowerCase();
      const matchesSearch =
        !q ||
        String(bag.name || '').toLowerCase().includes(q) ||
        String(bag.category || '').toLowerCase().includes(q) ||
        String(bag.colorName || '').toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [bags, selectedCategory, searchQuery]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (heroVideoRef.current) {
      heroVideoRef.current.muted = next;
    }
  };

  const isStaffOrAdmin = user?.role === 'staff' || user?.role === 'admin';

  if (view === 'admin' && isStaffOrAdmin) {
    return (
      <>
        <StaffPortal
          user={user}
          bags={bags}
          collections={collections}
          heroImage={heroImage}
          heroVideo={heroVideo}
          heroEyebrow={heroEyebrow}
          heroTitle={heroTitle}
          heroSubtitle={heroSubtitle}
          heroCtaText={heroCtaText}
          onRefreshBags={fetchBags}
          onRefreshCollections={fetchCollections}
          onRefreshSettings={fetchSettings}
          onBackToStore={() => setView('home')}
          showToast={showToast}
          onForceLogout={handleForceLogout}
        />
        {toast && (
          <div className={`sc-toast ${toast.type === 'error' ? 'error' : ''}`}>
            {toast.message}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app-shell">
      {/* Top Announcement Bar */}
      <div className="announcement-bar">
        <span>NATIONWIDE NIGERIA DISPATCH • AUTHENTIC DESIGNER HANDBAGS</span>
      </div>

      {/* Main Header */}
      <header className="site-header">
        <div className="header-inner">
          <div className="header-left">
            <button
              type="button"
              className="icon-btn mobile-only"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>

            <button
              type="button"
              className="brand-wordmark"
              onClick={() => {
                setView('home');
                setSelectedCategory('All');
              }}
            >
              SINGLE CHOICE
            </button>
          </div>

          <nav className="desktop-nav" aria-label="Primary Navigation">
            <button
              type="button"
              className={`nav-link ${view === 'home' ? 'active' : ''}`}
              onClick={() => setView('home')}
            >
              <Home size={15} /> Home
            </button>
            <button
              type="button"
              className={`nav-link ${view === 'shop' ? 'active' : ''}`}
              onClick={() => setView('shop')}
            >
              <Sparkles size={15} /> Collection
            </button>
            <button
              type="button"
              className={`nav-link ${view === 'saved' ? 'active' : ''}`}
              onClick={() => setView('saved')}
            >
              <Heart size={15} /> Saved ({savedItems.length})
            </button>
            {user?.role === 'customer' && (
              <button
                type="button"
                className={`nav-link ${view === 'orders' ? 'active' : ''}`}
                onClick={() => {
                  fetchOrders();
                  setView('orders');
                }}
              >
                <Truck size={15} /> My Orders ({orders.length})
              </button>
            )}
            {isStaffOrAdmin && (
              <button
                type="button"
                className="nav-link"
                onClick={() => setView('admin')}
              >
                <ShieldCheck size={15} /> Staff Portal
              </button>
            )}
            <button
              type="button"
              className="nav-link"
              onClick={() => setContactOpen(true)}
            >
              <MessageCircle size={15} /> Concierge
            </button>
          </nav>

          <div className="header-right">
            {user ? (
              <div className="user-chip-group">
                <span className="user-greeting">Hi, {user.name?.split(' ')[0] || 'Client'}</span>
                <button type="button" className="btn-ghost-sm" onClick={handleLogout}>
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="icon-btn"
                onClick={() => openAuthModal('login')}
                aria-label="Sign in"
              >
                <User size={20} />
              </button>
            )}

            <button
              type="button"
              className="bag-btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open shopping bag"
            >
              <ShoppingBag size={20} />
              <span className="bag-count">{cartCount}</span>
            </button>
          </div>
        </div>
      </header>

      {/* HOME VIEW */}
      {view === 'home' && (
        <main>
          <section className="hero-banner">
            {heroVideo ? (
              <video
                ref={heroVideoRef}
                className="hero-media"
                src={resolveBagImage(heroVideo)}
                poster={heroImage ? resolveBagImage(heroImage) : undefined}
                autoPlay
                loop
                muted={isMuted}
                playsInline
              />
            ) : (
              <img
                className="hero-media"
                src={resolveBagImage(heroImage)}
                alt={heroTitle}
              />
            )}
            <div className="hero-scrim" />

            {heroVideo && (
              <button
                type="button"
                className="hero-mute-btn"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute campaign video' : 'Mute campaign video'}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            )}

            <div className="hero-content">
              <span className="hero-eyebrow">{heroEyebrow}</span>
              <h1 className="hero-title">{heroTitle}</h1>
              <p className="hero-subtitle">{heroSubtitle}</p>
              <button
                type="button"
                className="btn-hero"
                onClick={() => setView('shop')}
              >
                {heroCtaText || 'Discover the Collection'}
              </button>
            </div>
          </section>

          <section className="page-container">
            <div className="section-header-row">
              <div>
                <span className="eyebrow-gold">CURATED SILHOUETTES</span>
                <h2 className="editorial-heading">Featured Pieces</h2>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setView('shop')}
              >
                View All ({bags.length})
              </button>
            </div>

            {loadingBags ? (
              <div className="empty-state-card">Loading collection...</div>
            ) : (
              <div className="bag-grid">
                {bags.slice(0, 6).map((bag) => {
                  const totalStock = getBagTotalStock(bag);
                  const primaryColor = getBagPrimaryColor(bag);
                  const coverSrc = resolveBagImage(bag.image || bag.images?.[0]);
                  const saved = isItemSaved(bag._id, primaryColor);

                  return (
                    <article key={bag._id} className="bag-card">
                      <div
                        className="bag-card-img-wrap"
                        onClick={() => setActiveBagModal({ bag, color: primaryColor })}
                      >
                        <img
                          src={coverSrc}
                          alt={bag.name}
                          className="bag-card-img"
                          loading="lazy"
                        />
                        <button
                          type="button"
                          className={`bag-card-save-icon ${saved ? 'saved' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSaveItem(bag, primaryColor);
                          }}
                          aria-label={saved ? 'Remove from saved items' : 'Save item'}
                        >
                          <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
                        </button>
                      </div>

                      <div className="bag-card-body">
                        <div className="bag-card-meta">
                          <span>{bag.category || 'Handbag'}</span>
                          <span>{primaryColor}</span>
                        </div>
                        <h3 className="bag-card-title">{bag.name}</h3>
                        <div className="bag-card-bottom">
                          <span className="bag-card-price">
                            ₦{Number(bag.price || 0).toLocaleString()}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn-ghost-sm"
                              onClick={() => setActiveBagModal({ bag, color: primaryColor })}
                              aria-label={`Inspect ${bag.name}`}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn-primary-sm"
                              disabled={totalStock <= 0}
                              onClick={() => handleAddToBag(bag, 1, primaryColor)}
                            >
                              {totalStock <= 0 ? 'Sold Out' : 'Add to Bag'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      )}

      {/* SHOP / COLLECTION VIEW */}
      {view === 'shop' && (
        <main className="page-container">
          <div className="section-header-row">
            <div>
              <span className="eyebrow-gold">SINGLE CHOICE CATALOG</span>
              <h1 className="editorial-heading">Handbag Collection</h1>
            </div>
            <div className="search-box">
              <Search size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or color..."
              />
            </div>
          </div>

          <div className="category-pills">
            <button
              type="button"
              className={`pill-btn ${selectedCategory === 'All' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('All')}
            >
              All ({bags.length})
            </button>
            {collections.map((col) => (
              <button
                key={col._id || col.name}
                type="button"
                className={`pill-btn ${selectedCategory === col.name ? 'active' : ''}`}
                onClick={() => setSelectedCategory(col.name)}
              >
                {col.name}
              </button>
            ))}
          </div>

          {loadingBags ? (
            <div className="empty-state-card">Loading collection...</div>
          ) : filteredBags.length === 0 ? (
            <div className="empty-state-card">No handbags matched your selection.</div>
          ) : (
            <div className="bag-grid">
              {filteredBags.map((bag) => {
                const totalStock = getBagTotalStock(bag);
                const primaryColor = getBagPrimaryColor(bag);
                const coverSrc = resolveBagImage(bag.image || bag.images?.[0]);
                const saved = isItemSaved(bag._id, primaryColor);

                return (
                  <article key={bag._id} className="bag-card">
                    <div
                      className="bag-card-img-wrap"
                      onClick={() => setActiveBagModal({ bag, color: primaryColor })}
                    >
                      <img
                        src={coverSrc}
                        alt={bag.name}
                        className="bag-card-img"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        className={`bag-card-save-icon ${saved ? 'saved' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSaveItem(bag, primaryColor);
                        }}
                        aria-label={saved ? 'Remove from saved items' : 'Save item'}
                      >
                        <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
                      </button>
                    </div>

                    <div className="bag-card-body">
                      <div className="bag-card-meta">
                        <span>{bag.category || 'Handbag'}</span>
                        <span>{totalStock > 0 ? `${totalStock} in stock` : 'Sold out'}</span>
                      </div>
                      <h3 className="bag-card-title">{bag.name}</h3>
                      <div className="bag-card-bottom">
                        <span className="bag-card-price">
                          ₦{Number(bag.price || 0).toLocaleString()}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => setActiveBagModal({ bag, color: primaryColor })}
                            aria-label={`Inspect ${bag.name}`}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn-primary-sm"
                            disabled={totalStock <= 0}
                            onClick={() => handleAddToBag(bag, 1, primaryColor)}
                          >
                            {totalStock <= 0 ? 'Sold Out' : 'Add to Bag'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* SAVED ITEMS VIEW */}
      {view === 'saved' && (
        <main className="page-container">
          <div className="section-header-row">
            <div>
              <span className="eyebrow-gold">PERSONAL WISHLIST</span>
              <h1 className="editorial-heading">Saved Pieces ({savedItems.length})</h1>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setView('shop')}>
              Browse Collection
            </button>
          </div>

          {savedItems.length === 0 ? (
            <div className="empty-state-card">
              You have no saved handbags yet. Tap the heart icon on any piece to save it here.
            </div>
          ) : (
            <div className="bag-grid">
              {savedItems.map((item, idx) => {
                const liveBag = bags.find((b) => String(b._id) === String(item.bagId));
                const bagObj = liveBag || {
                  _id: item.bagId,
                  name: item.name,
                  category: item.category,
                  price: item.price,
                  colorName: item.selectedColor,
                  image: item.image,
                };
                const stockCount = liveBag ? getBagColorStock(liveBag, item.selectedColor) : 1;

                return (
                  <article key={`${item.bagId}-${item.selectedColor}-${idx}`} className="bag-card">
                    <div
                      className="bag-card-img-wrap"
                      onClick={() => setActiveBagModal({ bag: bagObj, color: item.selectedColor })}
                    >
                      <img
                        src={resolveBagImage(item.image)}
                        alt={item.name}
                        className="bag-card-img"
                      />
                    </div>
                    <div className="bag-card-body">
                      <div className="bag-card-meta">
                        <span>{item.category || 'Handbag'}</span>
                        <span>{item.selectedColor}</span>
                      </div>
                      <h3 className="bag-card-title">{item.name}</h3>
                      <div className="bag-card-bottom">
                        <span className="bag-card-price">
                          ₦{Number(item.price || 0).toLocaleString()}
                        </span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => handleToggleSaveItem(bagObj, item.selectedColor)}
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            className="btn-primary-sm"
                            disabled={stockCount <= 0}
                            onClick={() => handleAddToBag(bagObj, 1, item.selectedColor)}
                          >
                            {stockCount <= 0 ? 'Sold Out' : 'Add to Bag'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* CUSTOMER MY ORDERS & DISPATCH VIEW (#4) */}
      {view === 'orders' && (
        <main className="page-container">
          <div className="section-header-row">
            <div>
              <span className="eyebrow-gold">ORDER HISTORY</span>
              <h1 className="editorial-heading">My Orders &amp; Dispatch</h1>
            </div>
            <button type="button" className="btn-secondary" onClick={() => setView('shop')}>
              Continue Shopping
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="empty-state-card">No orders placed yet.</div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <div key={order._id} className="order-card">
                  <div className="order-card-top">
                    <div>
                      <strong>ORDER #{String(order._id || '').slice(-6).toUpperCase()}</strong>
                      <span className="order-date">
                        {order.createdAt ? new Date(order.createdAt).toLocaleString('en-NG') : ''}
                      </span>
                    </div>
                    <span
                      className={`status-pill ${
                        order.paymentStatus === 'paid' ? 'paid' : 'pending'
                      }`}
                    >
                      {order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus || 'Pending'}
                    </span>
                  </div>

                  <div className="order-items-list">
                    {(order.items || []).map((item, idx) => (
                      <div key={idx} className="order-item-row">
                        <span>
                          {item.name} × {item.qty}
                        </span>
                        <strong>
                          ₦{(Number(item.price || 0) * Number(item.qty || 1)).toLocaleString()}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <div className="order-card-footer">
                    <div className="order-address">
                      <MapPin size={14} />
                      <span>
                        {order.delivery?.streetAddress}, {order.delivery?.area}
                        {order.delivery?.courierName ? ` • ${order.delivery.courierName}` : ''}
                        {order.fulfillmentStatus ? ` • Status: ${order.fulfillmentStatus}` : ''}
                        {order.trackingNumber ? ` • Tracking: ${order.trackingNumber}` : ''}
                      </span>
                    </div>
                    <div className="order-total">
                      Total: <strong>₦{Number(order.totalAmount || 0).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* Footer */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <div className="footer-brand">SINGLE CHOICE</div>
            <p className="footer-copy">
              Luxury handbags curated with attention to silhouette, finish, and nationwide dispatch across Nigeria.
            </p>
          </div>

          <div className="footer-contact">
            <div><Phone size={14} /> +234 800 000 0000</div>
            <div><Mail size={14} /> 1singlechoice@gmail.com</div>
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => setContactOpen(true)}
            >
              Contact Concierge
            </button>
          </div>
        </div>
      </footer>

      {/* Bag Slide-Over Drawer & Mobile Nav */}
      {drawerOpen && (
        <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}>
          <aside className="bag-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Your Shopping Bag ({cartCount})</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close bag"
              >
                <X size={20} />
              </button>
            </div>

            <div className="drawer-mobile-links">
              <button type="button" onClick={() => { setView('home'); setDrawerOpen(false); }}>Home</button>
              <button type="button" onClick={() => { setView('shop'); setDrawerOpen(false); }}>Collection</button>
              <button type="button" onClick={() => { setView('saved'); setDrawerOpen(false); }}>Saved ({savedItems.length})</button>
              {user?.role === 'customer' && (
                <button type="button" onClick={() => { setView('orders'); setDrawerOpen(false); }}>My Orders</button>
              )}
              {isStaffOrAdmin && (
                <button type="button" onClick={() => { setView('admin'); setDrawerOpen(false); }}>Staff Portal</button>
              )}
            </div>

            <div className="drawer-body">
              {cart.length === 0 ? (
                <div className="drawer-empty">Your shopping bag is currently empty.</div>
              ) : (
                cart.map((item, idx) => (
                  <div
                    key={`${item.bag?._id}-${item.selectedColor || idx}`}
                    className="cart-item-row"
                  >
                    <img
                      src={resolveBagImage(item.bag?.image || item.bag?.images?.[0])}
                      alt={item.bag?.name || 'Handbag'}
                      className="cart-item-img"
                    />
                    <div className="cart-item-info">
                      <h4>{item.bag?.name}</h4>
                      <span className="cart-item-color">
                        {item.selectedColor || getBagPrimaryColor(item.bag)}
                      </span>
                      <div className="cart-item-price">
                        ₦{Number(item.bag?.price || 0).toLocaleString()}
                      </div>
                      <div className="qty-controls">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item, -1)}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>
                        <span>{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item, 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                        <button
                          type="button"
                          className="remove-item-btn"
                          onClick={() => handleRemoveItem(item)}
                          aria-label="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="drawer-footer">
                <div className="drawer-subtotal">
                  <span>Subtotal</span>
                  <strong>₦{cartSubtotal.toLocaleString()}</strong>
                </div>
                <button
                  type="button"
                  className="btn-primary full-width"
                  onClick={handleOpenCheckout}
                >
                  Proceed to Checkout
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Bag Detail Modal */}
      {activeBagModal && (
        <BagDetailModal
          bag={activeBagModal.bag}
          initialColor={activeBagModal.color}
          onClose={() => setActiveBagModal(null)}
          onAddToBag={handleAddToBag}
          isSaved={isItemSaved}
          onToggleSave={handleToggleSaveItem}
        />
      )}

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="modal-backdrop" onClick={() => setCheckoutOpen(false)}>
          <div className="modal-card checkout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delivery &amp; Checkout</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Close checkout"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="modal-form">
              {checkoutError && <div className="form-error">{checkoutError}</div>}

              <div className="form-row-2">
                <div className="form-group">
                  <label>State *</label>
                  <select
                    value={deliveryState}
                    onChange={(e) => setDeliveryState(e.target.value)}
                  >
                    {NIGERIA_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>City / LGA</label>
                  <input
                    type="text"
                    value={deliveryCity}
                    onChange={(e) => setDeliveryCity(e.target.value)}
                    placeholder="e.g. Ikeja, Lekki"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Street Address *</label>
                <input
                  type="text"
                  required
                  value={streetAddress}
                  onChange={(e) => {
                    setStreetAddress(e.target.value);
                    setSelectedCoords(null);
                  }}
                  placeholder="House number and street name"
                />
                {loadingAddressSuggestions && (
                  <small className="helper-hint">Finding matching addresses...</small>
                )}
                {addressSuggestions.length > 0 && (
                  <div className="address-suggestions">
                    {addressSuggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="address-suggestion-item"
                        onClick={() => handleSelectSuggestion(s)}
                      >
                        <MapPin size={14} />
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Area / Landmark</label>
                  <input
                    type="text"
                    value={deliveryArea}
                    onChange={(e) => setDeliveryArea(e.target.value)}
                    placeholder="e.g. Admiralty Way"
                  />
                </div>

                <div className="form-group">
                  <label>Recipient Phone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="080..."
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="courier-header-row">
                  <label>Courier Dispatch Option</label>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={fetchShippingQuotes}
                    disabled={loadingRates}
                  >
                    {loadingRates ? 'Checking...' : 'Refresh Rates'}
                  </button>
                </div>

                {rateError && <div className="helper-hint error">{rateError}</div>}

                {shippingQuotes.length > 0 && (
                  <div className="courier-list">
                    {shippingQuotes.map((q) => (
                      <label
                        key={q.id}
                        className={`courier-option ${
                          selectedQuote?.id === q.id ? 'selected' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="courierQuote"
                          checked={selectedQuote?.id === q.id}
                          onChange={() => setSelectedQuoteId(q.id)}
                        />
                        <div className="courier-meta">
                          <strong>{q.courierName}</strong>
                          <span>{q.serviceName} • {q.eta}</span>
                        </div>
                        <strong>₦{Number(q.fee || 0).toLocaleString()}</strong>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="checkout-summary">
                <div>
                  <span>Items Subtotal</span>
                  <span>₦{cartSubtotal.toLocaleString()}</span>
                </div>
                <div>
                  <span>Delivery Fee</span>
                  <span>₦{activeDeliveryFee.toLocaleString()}</span>
                </div>
                <div className="checkout-total-row">
                  <span>Total Payable</span>
                  <strong>₦{(cartSubtotal + activeDeliveryFee).toLocaleString()}</strong>
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary full-width"
                disabled={checkingOut}
              >
                {checkingOut ? 'Redirecting to Paystack...' : 'Pay with Paystack'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      {authModalOpen && (
        <div className="modal-backdrop" onClick={() => setAuthModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {authMode === 'login' && 'Sign In'}
                {authMode === 'register' && 'Create Account'}
                {authMode === 'otp' && 'Verify Email Code'}
                {authMode === 'forgot' && 'Forgot Password'}
                {authMode === 'reset' && 'Reset Password'}
              </h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setAuthModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {authError && <div className="form-error">{authError}</div>}

            {authMode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="modal-form">
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <button type="submit" className="btn-primary full-width" disabled={authLoading}>
                  {authLoading ? 'Signing in...' : 'Sign In'}
                </button>
                <div className="auth-switch-links">
                  <button type="button" onClick={() => setAuthMode('forgot')}>
                    Forgot password?
                  </button>
                  <button type="button" onClick={() => setAuthMode('register')}>
                    Create an account
                  </button>
                </div>
              </form>
            )}

            {authMode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="modal-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Password (min 6 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <button type="submit" className="btn-primary full-width" disabled={authLoading}>
                  {authLoading ? 'Sending code...' : 'Continue'}
                </button>
                <div className="auth-switch-links">
                  <button type="button" onClick={() => setAuthMode('login')}>
                    <ArrowLeft size={13} /> Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {authMode === 'otp' && (
              <form onSubmit={handleVerifyOtpSubmit} className="modal-form">
                <p className="helper-hint">
                  Enter the 6-digit code sent to <strong>{authEmail}</strong>.
                </p>
                <div className="form-group">
                  <label>6-Digit Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                  />
                </div>
                <button type="submit" className="btn-primary full-width" disabled={authLoading}>
                  {authLoading ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </form>
            )}

            {authMode === 'forgot' && (
              <form onSubmit={handleForgotPasswordSubmit} className="modal-form">
                <div className="form-group">
                  <label>Account Email</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <button type="submit" className="btn-primary full-width" disabled={authLoading}>
                  {authLoading ? 'Sending code...' : 'Send Reset Code'}
                </button>
                <div className="auth-switch-links">
                  <button type="button" onClick={() => setAuthMode('login')}>
                    Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {authMode === 'reset' && (
              <form onSubmit={handleResetPasswordSubmit} className="modal-form">
                <div className="form-group">
                  <label>6-Digit Reset Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                  />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authNewPassword}
                    onChange={(e) => setAuthNewPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <button type="submit" className="btn-primary full-width" disabled={authLoading}>
                  {authLoading ? 'Updating password...' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Concierge Contact Modal */}
      {contactOpen && (
        <div className="modal-backdrop" onClick={() => setContactOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Single Choice Concierge</h3>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setContactOpen(false)}
                aria-label="Close concierge modal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleContactSubmit} className="modal-form">
              <div className="form-group">
                <label>Your Name *</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="form-group">
                <label>Phone / WhatsApp</label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+234..."
                />
              </div>
              <div className="form-group">
                <label>Subject</label>
                <input
                  type="text"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  placeholder="Sourcing, delivery, or styling question"
                />
              </div>
              <div className="form-group">
                <label>Message *</label>
                <textarea
                  rows={4}
                  required
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="How can we assist you?"
                />
              </div>
              <button type="submit" className="btn-primary full-width" disabled={sendingContact}>
                {sendingContact ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={`sc-toast ${toast.type === 'error' ? 'error' : ''}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}