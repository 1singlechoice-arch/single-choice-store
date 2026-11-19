import React, { useState, useEffect, useCallback } from 'react';
import {
  Menu,
  X,
  ShoppingBag,
  User,
  Search,
  ChevronRight,
  ChevronLeft,
  Shield,
  LogOut,
  Minus,
  Plus,
  Trash2,
  Package,
  MapPin,
  Mail,
  Phone,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import StaffPortal from './components/StaffPortal';
import AuthModal from './components/AuthModal';
import { apiRequest } from './utils/api';

const LAGOS_AREAS = [
  'Victoria Island',
  'Ikoyi',
  'Lekki Phase 1',
  'Lekki (Other / Chevron / Ajah)',
  'Ikeja GRA / Ikeja',
  'Surulere',
  'Yaba',
  'Mainland (Other)',
];

const isStaffRole = (role) => role === 'admin' || role === 'staff';

export default function App() {
  const [bags, setBags] = useState([]);
  const [collections, setCollections] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedCollection, setSelectedCollection] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('sc_token') || '');
  const [authChecking, setAuthChecking] = useState(() => Boolean(localStorage.getItem('sc_token')));

  const [activeView, setActiveView] = useState('storefront'); // 'storefront' | 'orders' | 'contact' | 'admin'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [deliveryArea, setDeliveryArea] = useState(LAGOS_AREAS[0]);
  const [streetAddress, setStreetAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const [selectedBag, setSelectedBag] = useState(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authInitialMode, setAuthInitialMode] = useState('login');

  const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sendingContact, setSendingContact] = useState(false);

  const [toast, setToast] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const loadBags = async () => {
    try {
      setLoadingCatalog(true);
      const data = await apiRequest('/api/bags');
      setBags(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast('Could not load handbag catalog.', 'error');
    } finally {
      setLoadingCatalog(false);
    }
  };

  const loadCollections = async () => {
    try {
      const data = await apiRequest('/api/collections');
      setCollections(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await apiRequest('/api/settings');
      setSettings(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadCart = useCallback(
    async (activeToken = token, role = user?.role) => {
      const resolvedToken = activeToken || localStorage.getItem('sc_token') || '';
      if (!resolvedToken || isStaffRole(role)) {
        setCart([]);
        return;
      }
      try {
        const data = await apiRequest('/api/cart', { token: resolvedToken });
        setCart(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err?.status !== 403) {
          console.error(err);
        }
      }
    },
    [token, user?.role]
  );

  const loadOrders = useCallback(
    async (activeToken = token) => {
      const resolvedToken = activeToken || localStorage.getItem('sc_token') || '';
      if (!resolvedToken) return;
      try {
        setLoadingOrders(true);
        const data = await apiRequest('/api/orders/my', { token: resolvedToken });
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingOrders(false);
      }
    },
    [token]
  );

  useEffect(() => {
    loadBags();
    loadCollections();
    loadSettings();
  }, []);

  useEffect(() => {
    const activeToken = token || localStorage.getItem('sc_token') || '';
    if (!activeToken) {
      setUser(null);
      setCart([]);
      setAuthChecking(false);
      return;
    }

    let cancelled = false;
    setAuthChecking(true);

    apiRequest('/api/auth/me', { token: activeToken })
      .then((res) => {
        if (cancelled) return;
        const resolvedUser = res?.user || res;
        if (resolvedUser && (resolvedUser._id || resolvedUser.id || resolvedUser.email)) {
          setUser(resolvedUser);
          if (isStaffRole(resolvedUser.role)) {
            setCart([]);
            setCartOpen(false);
            setCheckoutOpen(false);
          } else {
            loadCart(activeToken, resolvedUser.role);
          }
          loadOrders(activeToken);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.status === 401) {
          localStorage.removeItem('sc_token');
          setToken('');
          setUser(null);
          setCart([]);
        } else {
          console.warn('Auth check did not return 401; preserving session:', err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthChecking(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, loadCart, loadOrders]);

  useEffect(() => {
    const activeToken = token || localStorage.getItem('sc_token') || '';
    const params = new URLSearchParams(window.location.search);
    const paymentRef = params.get('reference') || params.get('trxref');
    if (!paymentRef || !activeToken || isStaffRole(user?.role)) return;

    let cancelled = false;
    apiRequest(`/api/checkout/verify/${encodeURIComponent(paymentRef)}`, { token: activeToken })
      .then(() => {
        if (cancelled) return;
        window.history.replaceState({}, document.title, window.location.pathname);
        showToast('Payment confirmed! Your order is now being processed.');
        loadCart(activeToken, user?.role);
        loadOrders(activeToken);
        setActiveView('orders');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Payment verification error:', err);
        loadOrders(activeToken);
        setActiveView('orders');
      });

    return () => {
      cancelled = true;
    };
  }, [token, user?.role, loadCart, loadOrders, showToast]);

  const handleLogout = () => {
    localStorage.removeItem('sc_token');
    setToken('');
    setUser(null);
    setCart([]);
    setCartOpen(false);
    setCheckoutOpen(false);
    setActiveView('storefront');
    setMobileMenuOpen(false);
    showToast('Signed out successfully.');
  };

  const handleAuthSuccess = (data) => {
    const nextToken = data?.token || localStorage.getItem('sc_token') || '';
    const nextUser = data?.user || null;
    if (!nextToken || !nextUser) return;

    localStorage.setItem('sc_token', nextToken);
    setUser(nextUser);
    setToken(nextToken);
    setAuthChecking(false);
    setAuthModalOpen(false);
    showToast(`Welcome back, ${nextUser.name.split(' ')[0]}!`);

    if (isStaffRole(nextUser.role)) {
      setCart([]);
      setCartOpen(false);
      setCheckoutOpen(false);
    } else {
      loadCart(nextToken, nextUser.role);
    }
    loadOrders(nextToken);
  };

  const resolveBagImage = (imgUrl) => {
    if (!imgUrl) return '';
    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) return imgUrl;
    const backendBase = import.meta.env.VITE_API_URL || '';
    return `${backendBase}${imgUrl.startsWith('/') ? '' : '/'}${imgUrl}`;
  };

  const navigateToCollection = (colName) => {
    setSelectedCollection(colName);
    setActiveView('storefront');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToPage = (view) => {
    setActiveView(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (view === 'orders') loadOrders();
  };

  const openBagQuickView = (bag) => {
    setSelectedBag(bag);
    setSelectedColor(bag.colorName || 'Classic');
    setSelectedQty(1);
    setActivePhotoIndex(0);
  };

  const handleAddToBag = async (bag, color, qtyDelta = 1) => {
    if (isStaffRole(user?.role)) {
      showToast('Staff and admin accounts cannot purchase items.', 'error');
      return;
    }

    const colorToUse = color || bag.colorName || 'Classic';
    const activeToken = token || localStorage.getItem('sc_token') || '';
    if (!activeToken) {
      setAuthInitialMode('login');
      setAuthModalOpen(true);
      showToast('Please sign in to add pieces to your shopping bag.', 'error');
      return;
    }
    try {
      const updatedCart = await apiRequest('/api/cart', {
        token: activeToken,
        method: 'POST',
        body: JSON.stringify({ bagId: bag._id, qty: qtyDelta, selectedColor: colorToUse }),
      });
      setCart(Array.isArray(updatedCart) ? updatedCart : []);
      showToast(`Added ${bag.name} (${colorToUse}) to bag.`);
    } catch (err) {
      showToast(err.message || 'Could not update bag.', 'error');
    }
  };

  const handleRemoveFromCart = async (bagId, color) => {
    if (isStaffRole(user?.role)) return;
    try {
      const query = color ? `?color=${encodeURIComponent(color)}` : '';
      const updatedCart = await apiRequest(`/api/cart/${bagId}${query}`, {
        token,
        method: 'DELETE',
      });
      setCart(Array.isArray(updatedCart) ? updatedCart : []);
      showToast('Removed item from shopping bag.');
    } catch (err) {
      showToast('Could not remove item.', 'error');
    }
  };

  const handleInitializeCheckout = async (e) => {
    e.preventDefault();
    if (isStaffRole(user?.role)) {
      showToast('Staff and admin accounts cannot place orders.', 'error');
      return;
    }
    if (cart.length === 0) return;
    setCheckingOut(true);
    try {
      const data = await apiRequest('/api/checkout/initialize', {
        token,
        method: 'POST',
        body: JSON.stringify({
          area: deliveryArea,
          streetAddress: streetAddress.trim(),
          phone: deliveryPhone.trim(),
        }),
      });

      if (data?.authorization_url && /^https?:\/\//i.test(data.authorization_url)) {
        setCartOpen(false);
        setCheckoutOpen(false);
        window.location.assign(data.authorization_url);
        return;
      }

      showToast('Order placed successfully! Awaiting bank transfer confirmation.');
      setCartOpen(false);
      setCheckoutOpen(false);
      loadCart(token, user?.role);
      loadOrders(token);
      navigateToPage('orders');
    } catch (err) {
      showToast(err.message || 'Could not initialize checkout.', 'error');
    } finally {
      setCheckingOut(false);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSendingContact(true);
    try {
      const data = await apiRequest('/api/contact', {
        method: 'POST',
        body: JSON.stringify(contactForm),
      });
      showToast(data.message || 'Message sent to concierge.');
      setContactForm({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      showToast(err.message || 'Could not send message.', 'error');
    } finally {
      setSendingContact(false);
    }
  };

  const filteredBags = bags.filter((bag) => {
    const matchesCol =
      selectedCollection === 'All' || bag.category?.toLowerCase() === selectedCollection.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      bag.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bag.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bag.colorName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCol && matchesSearch;
  });

  const isStaff = Boolean(user && isStaffRole(user.role));
  const totalCartItems = isStaff ? 0 : cart.reduce((sum, item) => sum + item.qty, 0);
  const cartSubtotal = isStaff ? 0 : cart.reduce((sum, item) => sum + (item.bag?.price || 0) * item.qty, 0);

  const activeBagPresentation = selectedBag
    ? (() => {
        const primaryColor = selectedBag.colorName || 'Classic';
        const isPrimary = selectedColor.toLowerCase() === primaryColor.toLowerCase();
        const matchedVariant = !isPrimary
          ? (selectedBag.variants || []).find(
              (v) => v.colorName.toLowerCase() === selectedColor.toLowerCase()
            )
          : null;

        const variantPhotos = matchedVariant
          ? [matchedVariant.image, ...(matchedVariant.images || [])].filter(Boolean)
          : [];
        const fallbackPhotos = [selectedBag.image, ...(selectedBag.images || [])].filter(Boolean);

        const rawColors = [
          {
            colorName: primaryColor,
            colorHex: selectedBag.colorHex || '#142B22',
            stock: selectedBag.stock ?? 1,
          },
          ...(selectedBag.variants || []).map((v) => ({
            colorName: v.colorName,
            colorHex: v.colorHex || '#142B22',
            stock: v.stock ?? 1,
          })),
        ];

        const uniqueColors = rawColors.filter(
          (c, idx, arr) => arr.findIndex((item) => item.colorName.toLowerCase() === c.colorName.toLowerCase()) === idx
        );

        return {
          photos: variantPhotos.length > 0 ? variantPhotos : fallbackPhotos,
          stock: isPrimary ? selectedBag.stock ?? 1 : matchedVariant?.stock ?? 1,
          allColors: uniqueColors,
        };
      })()
    : { photos: [], stock: 1, allColors: [] };

  return (
    <div className="site-wrapper">
      {/* HEADER */}
      <header className="site-header">
        <div className="header-mobile-left desktop-hide">
          <button
            type="button"
            className="icon-btn burger-btn"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open mobile menu"
          >
            <Menu size={22} />
          </button>
        </div>

        <div className="header-brand-wrap" onClick={() => navigateToCollection('All')} role="button" tabIndex={0}>
          <span className="brand-logo-text">SINGLE CHOICE</span>
        </div>

        <nav className="header-nav-desktop mobile-hide">
          <button
            type="button"
            className={`nav-link ${activeView === 'storefront' && selectedCollection === 'All' ? 'active' : ''}`}
            onClick={() => navigateToCollection('All')}
          >
            All Handbags
          </button>
          {collections.map((col) => (
            <button
              key={col._id || col.name}
              type="button"
              className={`nav-link ${
                activeView === 'storefront' && selectedCollection === col.name ? 'active' : ''
              }`}
              onClick={() => navigateToCollection(col.name)}
            >
              {col.name}
            </button>
          ))}
          <button
            type="button"
            className={`nav-link ${activeView === 'contact' ? 'active' : ''}`}
            onClick={() => navigateToPage('contact')}
          >
            Concierge
          </button>
        </nav>

        <div className="header-actions">
          {isStaff && (
            <button
              type="button"
              className="btn-secondary mobile-hide"
              onClick={() => navigateToPage('admin')}
              style={{ padding: '8px 12px', fontSize: '13px' }}
            >
              <Shield size={14} style={{ marginRight: '6px' }} />
              Staff Portal
            </button>
          )}

          {user ? (
            <div className="mobile-hide" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigateToPage('orders')}
                style={{ padding: '8px 14px', fontSize: '13px' }}
              >
                <User size={14} style={{ marginRight: '6px' }} />
                {user.name.split(' ')[0]}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleLogout}
                style={{ padding: '8px 10px', fontSize: '13px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                title="Sign Out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : !authChecking ? (
            <button
              type="button"
              className="btn-secondary mobile-hide"
              onClick={() => {
                setAuthInitialMode('login');
                setAuthModalOpen(true);
              }}
              style={{ padding: '8px 14px', fontSize: '13px' }}
            >
              Sign In
            </button>
          ) : null}

          {!isStaff && (
            <button
              type="button"
              className="icon-btn bag-badge-btn"
              onClick={() => setCartOpen(true)}
              aria-label="Open shopping bag"
            >
              <ShoppingBag size={20} />
              {totalCartItems > 0 && <span className="bag-badge-count">{totalCartItems}</span>}
            </button>
          )}
        </div>
      </header>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div
          className="drawer-backdrop desktop-hide"
          style={{ zIndex: 3000 }}
          onClick={() => setMobileMenuOpen(false)}
          role="presentation"
        >
          <aside className="mobile-drawer" onClick={(e) => e.stopPropagation()} aria-label="Mobile Navigation">
            <div className="mobile-drawer-header">
              <span className="brand-logo-text" style={{ fontSize: '18px' }}>SINGLE CHOICE</span>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close mobile menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mobile-drawer-links">
              <button
                type="button"
                className={`mobile-drawer-link ${selectedCollection === 'All' ? 'active' : ''}`}
                onClick={() => navigateToCollection('All')}
              >
                <span>All Handbags ({bags.length})</span>
                <ChevronRight size={16} />
              </button>

              {collections.map((col) => (
                <button
                  key={col._id || col.name}
                  type="button"
                  className={`mobile-drawer-link ${selectedCollection === col.name ? 'active' : ''}`}
                  onClick={() => navigateToCollection(col.name)}
                >
                  <span>{col.name}</span>
                  <ChevronRight size={16} />
                </button>
              ))}

              <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '12px 0' }} />
              <div className="drawer-section-label" style={{ fontSize: '10.5px', letterSpacing: '0.16em', color: 'var(--champagne-gold)', fontWeight: '700', margin: '8px 0 4px' }}>
                CONCIERGE &amp; ACCOUNT
              </div>

              {isStaff && (
                <button
                  type="button"
                  className={`mobile-drawer-link ${activeView === 'admin' ? 'active' : ''}`}
                  onClick={() => navigateToPage('admin')}
                >
                  <span>Staff &amp; Inventory Portal</span>
                  <Shield size={16} />
                </button>
              )}

              {user ? (
                <>
                  <button
                    type="button"
                    className={`mobile-drawer-link ${activeView === 'orders' ? 'active' : ''}`}
                    onClick={() => navigateToPage('orders')}
                  >
                    <span>My Orders ({orders.length})</span>
                    <Package size={16} />
                  </button>
                  <button
                    type="button"
                    className="mobile-drawer-link"
                    onClick={() => navigateToPage('contact')}
                  >
                    <span>Client Concierge &amp; Contact</span>
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="mobile-drawer-link danger"
                    onClick={handleLogout}
                  >
                    <span>Sign Out ({user.name.split(' ')[0]})</span>
                    <LogOut size={16} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="mobile-drawer-link"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setAuthInitialMode('login');
                      setAuthModalOpen(true);
                    }}
                  >
                    <span>Sign In / Create Account</span>
                    <User size={16} />
                  </button>
                  <button
                    type="button"
                    className="mobile-drawer-link"
                    onClick={() => navigateToPage('contact')}
                  >
                    <span>Client Concierge &amp; Contact</span>
                    <ChevronRight size={16} />
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* MAIN VIEW CONTENT */}
      <main className="main-content">
        {activeView === 'admin' && isStaff ? (
          <StaffPortal
            user={user}
            bags={bags}
            collections={collections}
            heroImage={settings?.heroImage || ''}
            heroVideo={settings?.heroVideo || ''}
            heroEyebrow={settings?.heroEyebrow || ''}
            heroTitle={settings?.heroTitle || ''}
            heroSubtitle={settings?.heroSubtitle || ''}
            heroCtaText={settings?.heroCtaText || ''}
            onRefreshBags={loadBags}
            onRefreshCollections={loadCollections}
            onRefreshSettings={loadSettings}
            onRefreshCatalog={() => {
              loadBags();
              loadCollections();
              loadSettings();
            }}
            onBackToStore={() => navigateToCollection('All')}
            showToast={showToast}
            onForceLogout={handleLogout}
          />
        ) : activeView === 'orders' && user ? (
          <section className="page-container">
            <div className="section-header-row">
              <div>
                <span className="eyebrow-gold">CLIENT ACCOUNT</span>
                <h1 className="editorial-heading">My Orders &amp; Dispatch</h1>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigateToCollection('All')}
              >
                Continue Shopping
              </button>
            </div>

            {loadingOrders ? (
              <div className="empty-state-card">Loading your order history...</div>
            ) : orders.length === 0 ? (
              <div className="empty-state-card">
                <Package size={36} strokeWidth={1.3} />
                <h3>No Orders Placed Yet</h3>
                <p>Explore our latest luxury handbag arrivals curated in Lagos.</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigateToCollection('All')}
                >
                  Explore Handbags
                </button>
              </div>
            ) : (
              <div className="orders-list">
                {orders.map((order) => (
                  <div key={order._id} className="order-card">
                    <div className="order-card-top">
                      <div>
                        <span className="order-id">
                          ORDER #{order._id.slice(-6).toUpperCase()}
                        </span>
                        <div className="order-date">
                          {new Date(order.createdAt).toLocaleDateString('en-NG', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>
                      <span
                        className={`status-pill ${
                          order.paymentStatus === 'paid' ? 'paid' : 'pending'
                        }`}
                      >
                        {order.paymentStatus === 'paid' ? 'Payment Confirmed' : 'Awaiting Transfer'}
                      </span>
                    </div>

                    <div className="order-items-grid">
                      {order.items.map((item, i) => (
                        <div key={i} className="order-item-row">
                          <span>
                            {item.name} — Qty: {item.qty}
                          </span>
                          <strong>₦{(item.price * item.qty).toLocaleString()}</strong>
                        </div>
                      ))}
                    </div>

                    <div className="order-card-footer">
                      <div className="order-address">
                        <MapPin size={14} />
                        <span>
                          {order.delivery?.streetAddress}, {order.delivery?.area}
                        </span>
                      </div>
                      <div className="order-total">
                        Total: <strong>₦{order.totalAmount.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : activeView === 'contact' ? (
          <section
            className="page-container contact-section"
            style={{
              maxWidth: '1080px',
              margin: '0 auto',
              padding: '44px 20px 72px',
            }}
          >
            <div
              className="contact-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '36px',
                alignItems: 'start',
              }}
            >
              <div className="contact-info-panel">
                <span className="eyebrow-gold">CLIENT CONCIERGE</span>
                <h1 className="editorial-heading" style={{ marginTop: '6px', marginBottom: '14px' }}>
                  At Your Service
                </h1>
                <p
                  className="editorial-copy"
                  style={{
                    color: 'var(--text-muted)',
                    lineHeight: '1.65',
                    fontSize: '15px',
                    marginBottom: '28px',
                  }}
                >
                  Need styling advice, additional close-up videos of a piece, or urgent same-day
                  Lagos dispatch assistance? Reach out directly to our boutique concierge.
                </p>

                <div
                  className="concierge-details"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  <div
                    className="concierge-item"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      padding: '16px',
                      background: 'var(--bg-alabaster)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <MapPin size={20} style={{ color: 'var(--forest-green)', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--forest-green)' }}>
                        Lagos Boutique &amp; Dispatch Hub
                      </strong>
                      <span style={{ fontSize: '13.5px', color: 'var(--text-muted)' }}>
                        Victoria Island &amp; Lekki Dispatch Network, Lagos
                      </span>
                    </div>
                  </div>

                  <div
                    className="concierge-item"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      padding: '16px',
                      background: 'var(--bg-alabaster)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <Mail size={20} style={{ color: 'var(--forest-green)', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--forest-green)' }}>
                        Direct Concierge Email
                      </strong>
                      <span style={{ fontSize: '13.5px', color: 'var(--text-muted)' }}>
                        1singlechoice@gmail.com
                      </span>
                    </div>
                  </div>

                  <div
                    className="concierge-item"
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '14px',
                      padding: '16px',
                      background: 'var(--bg-alabaster)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <Phone size={20} style={{ color: 'var(--forest-green)', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--forest-green)' }}>
                        Dispatch Hours
                      </strong>
                      <span style={{ fontSize: '13.5px', color: 'var(--text-muted)' }}>
                        Monday — Saturday, 9:00 AM — 7:00 PM WAT
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <form
                className="contact-form-card"
                onSubmit={handleContactSubmit}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid var(--border-subtle)',
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '21px',
                    color: 'var(--forest-green)',
                    margin: '0 0 4px',
                  }}
                >
                  Send a Message
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--forest-green)' }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    placeholder="Your full name"
                    style={{
                      width: '100%',
                      padding: '11px 12px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-alabaster)',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--forest-green)' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="you@example.com"
                    style={{
                      width: '100%',
                      padding: '11px 12px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-alabaster)',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--forest-green)' }}>
                    Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="+234 800 000 0000"
                    style={{
                      width: '100%',
                      padding: '11px 12px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-alabaster)',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--forest-green)' }}>
                    Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    placeholder="Tell us which handbag you are interested in..."
                    style={{
                      width: '100%',
                      padding: '11px 12px',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-alabaster)',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button type="submit" className="btn-primary full-width" disabled={sendingContact}>
                  {sendingContact ? 'Sending Message...' : 'Send to Concierge'}
                </button>
              </form>
            </div>
          </section>
        ) : (
          <>
            {selectedCollection === 'All' && !searchQuery && (
              <section className="hero-banner">
                {settings?.heroVideo ? (
                  <video
                    className="hero-media"
                    src={resolveBagImage(settings.heroVideo)}
                    poster={settings?.heroImage ? resolveBagImage(settings.heroImage) : undefined}
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : settings?.heroImage ? (
                  <img
                    className="hero-media"
                    src={resolveBagImage(settings.heroImage)}
                    alt="Single Choice Luxury Collection"
                  />
                ) : (
                  <div className="hero-fallback-bg" />
                )}

                <div className="hero-overlay">
                  <div className="hero-content">
                    <span className="hero-eyebrow">
                      <Sparkles size={13} /> {settings?.heroEyebrow || 'SINGLE CHOICE • CAMPAIGN 2026'}
                    </span>
                    <h1 className="hero-title">{settings?.heroTitle || 'The Art of Carrying'}</h1>
                    <p className="hero-subtitle">
                      {settings?.heroSubtitle || 'Curated designer silhouettes crafted for timeless presence.'}
                    </p>
                    <div className="hero-actions">
                      <a href="#catalog-grid" className="btn-gold">
                        {settings?.heroCtaText || 'Discover the Collection'} <ArrowRight size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section id="catalog-grid" className="catalog-section">
              <div className="catalog-toolbar">
                <div className="collection-pills">
                  <button
                    type="button"
                    className={`pill-btn ${selectedCollection === 'All' ? 'active' : ''}`}
                    onClick={() => setSelectedCollection('All')}
                  >
                    All Pieces ({bags.length})
                  </button>
                  {collections.map((col) => (
                    <button
                      key={col._id || col.name}
                      type="button"
                      className={`pill-btn ${selectedCollection === col.name ? 'active' : ''}`}
                      onClick={() => setSelectedCollection(col.name)}
                    >
                      {col.name}
                    </button>
                  ))}
                </div>

                <div className="search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search handbags, colors..."
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="clear-search-btn"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="catalog-heading-row">
                <div>
                  <span className="eyebrow-gold">CURATED SELECTION</span>
                  <h2 className="section-title">
                    {selectedCollection === 'All' ? 'All Handbags' : selectedCollection}
                  </h2>
                </div>
                <span className="piece-count">
                  {filteredBags.length} {filteredBags.length === 1 ? 'Piece' : 'Pieces'} Available
                </span>
              </div>

              {loadingCatalog ? (
                <div className="bags-grid">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="bag-card skeleton-card">
                      <div className="skeleton-img" />
                      <div className="skeleton-line" />
                      <div className="skeleton-line short" />
                    </div>
                  ))}
                </div>
              ) : filteredBags.length === 0 ? (
                <div className="empty-state-card">
                  <h3>No Handbags Found</h3>
                  <p>No available pieces matched your current filter.</p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setSelectedCollection('All');
                      setSearchQuery('');
                    }}
                  >
                    Show All Handbags
                  </button>
                </div>
              ) : (
                <div className="bags-grid">
                  {filteredBags.map((bag) => {
                    const colorSwatches = [
                      {
                        colorName: bag.colorName || 'Classic',
                        colorHex: bag.colorHex || '#142B22',
                      },
                      ...(bag.variants || []).map((v) => ({
                        colorName: v.colorName,
                        colorHex: v.colorHex || '#142B22',
                      })),
                    ];

                    return (
                      <article
                        key={bag._id}
                        className="bag-card"
                        onClick={() => openBagQuickView(bag)}
                      >
                        <div className="bag-image-wrap">
                          <img
                            src={resolveBagImage(bag.image || bag.images?.[0])}
                            alt={bag.name}
                            loading="lazy"
                          />
                          <span className="bag-category-tag">{bag.category}</span>
                        </div>

                        <div className="bag-card-body">
                          <div className="bag-title-row">
                            <h3 className="bag-name">{bag.name}</h3>
                            <span className="bag-price">₦{Number(bag.price).toLocaleString()}</span>
                          </div>

                          <div className="bag-meta-row">
                            <div className="swatch-row">
                              {colorSwatches.map((sw, idx) => (
                                <span
                                  key={idx}
                                  className="color-dot"
                                  style={{ backgroundColor: sw.colorHex }}
                                  title={sw.colorName}
                                />
                              ))}
                              <span className="color-label">
                                {colorSwatches.length > 1 ? `${colorSwatches.length} Colors` : colorSwatches[0].colorName}
                              </span>
                            </div>

                            <button
                              type="button"
                              className="quick-add-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openBagQuickView(bag);
                              }}
                            >
                              Select
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* FOOTER */}
      <footer className="site-footer">
        <div className="footer-inner">
          <div>
            <div className="footer-brand">SINGLE CHOICE</div>
            <p className="footer-tagline">
              Luxury handbags curated in Lagos with insured same-day dispatch across Victoria
              Island, Ikoyi, Lekki, and Ikeja.
            </p>
          </div>

          <div className="footer-links">
            <button type="button" onClick={() => navigateToCollection('All')}>
              Shop All
            </button>
            <button type="button" onClick={() => navigateToPage('contact')}>
              Client Concierge
            </button>
            {user && (
              <button type="button" onClick={() => navigateToPage('orders')}>
                My Orders
              </button>
            )}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Single Choice. All rights reserved.</span>
        </div>
      </footer>

      {/* QUICK VIEW MODAL */}
      {selectedBag && (
        <div
          className="modal-backdrop"
          onClick={() => setSelectedBag(null)}
          role="presentation"
        >
          <div
            className="product-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="modal-close-circle"
              onClick={() => setSelectedBag(null)}
              aria-label="Close product view"
            >
              <X size={20} />
            </button>

            <div className="product-modal-grid">
              <div className="product-gallery">
                <div className="main-gallery-frame">
                  <img
                    src={resolveBagImage(
                      activeBagPresentation.photos[activePhotoIndex] ||
                        activeBagPresentation.photos[0] ||
                        selectedBag.image
                    )}
                    alt={selectedBag.name}
                  />
                  {activeBagPresentation.photos.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="gallery-arrow left"
                        onClick={() =>
                          setActivePhotoIndex((prev) =>
                            prev === 0 ? activeBagPresentation.photos.length - 1 : prev - 1
                          )
                        }
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        type="button"
                        className="gallery-arrow right"
                        onClick={() =>
                          setActivePhotoIndex((prev) =>
                            prev === activeBagPresentation.photos.length - 1 ? 0 : prev + 1
                          )
                        }
                      >
                        <ChevronRight size={18} />
                      </button>
                    </>
                  )}
                </div>

                {activeBagPresentation.photos.length > 1 && (
                  <div className="thumbnail-strip">
                    {activeBagPresentation.photos.map((photo, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`thumb-btn ${activePhotoIndex === idx ? 'active' : ''}`}
                        onClick={() => setActivePhotoIndex(idx)}
                      >
                        <img src={resolveBagImage(photo)} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="product-details-pane">
                <span className="eyebrow-gold">{selectedBag.category}</span>
                <h2 className="product-modal-title">{selectedBag.name}</h2>
                <div className="product-modal-price">
                  ₦{Number(selectedBag.price).toLocaleString()}
                </div>

                {activeBagPresentation.allColors.length > 0 && (
                  <div style={{ margin: '12px 0 14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--forest-green)' }}>
                      Color:{' '}
                      <span style={{ fontWeight: '400', color: 'var(--text-muted)' }}>
                        {selectedColor}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {activeBagPresentation.allColors.map((col) => {
                        const isSelected = selectedColor.toLowerCase() === col.colorName.toLowerCase();
                        return (
                          <button
                            key={col.colorName}
                            type="button"
                            onClick={() => {
                              setSelectedColor(col.colorName);
                              setActivePhotoIndex(0);
                              setSelectedQty((q) => Math.min(q, Math.max(1, col.stock)));
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '6px 12px',
                              border: isSelected
                                ? '1.5px solid var(--forest-green)'
                                : '1px solid var(--border-subtle)',
                              background: isSelected ? 'var(--bg-alabaster)' : '#FFFFFF',
                              fontSize: '12.5px',
                              fontWeight: isSelected ? '600' : '400',
                              color: 'var(--forest-green)',
                              cursor: 'pointer',
                            }}
                          >
                            <span
                              style={{
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                backgroundColor: col.colorHex,
                                border: '1px solid rgba(0,0,0,0.2)',
                                display: 'inline-block',
                              }}
                            />
                            <span>{col.colorName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedBag.description && (
                  <p className="product-modal-desc">{selectedBag.description}</p>
                )}

                {!isStaff && (
                  <div className="qty-selector-block">
                    <span style={{ fontSize: '13px', fontWeight: '600' }}>Quantity:</span>
                    <div className="qty-inline-controls">
                      <button
                        type="button"
                        onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
                      >
                        <Minus size={14} />
                      </button>
                      <span style={{ fontWeight: '700', minWidth: '20px', textAlign: 'center' }}>
                        {selectedQty}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedQty((q) => Math.min(activeBagPresentation.stock || 1, q + 1))
                        }
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="stock-status-line">
                  {activeBagPresentation.stock > 0 ? (
                    <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: '500' }}>
                      ✓ In Stock ({activeBagPresentation.stock} ready for dispatch)
                    </span>
                  ) : (
                    <span style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: '500' }}>
                      ✕ Sold Out
                    </span>
                  )}
                </div>

                {isStaff ? (
                  <div
                    style={{
                      padding: '12px 14px',
                      background: 'var(--bg-alabaster)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                    }}
                  >
                    Staff &amp; admin accounts cannot purchase items.
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-primary full-width"
                    disabled={activeBagPresentation.stock <= 0}
                    onClick={() => handleAddToBag(selectedBag, selectedColor, selectedQty)}
                  >
                    {activeBagPresentation.stock > 0
                      ? `Add to Shopping Bag — ₦${(Number(selectedBag.price) * selectedQty).toLocaleString()}`
                      : 'Sold Out'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHOPPING CART / CHECKOUT DRAWER */}
      {cartOpen && !isStaff && (
        <div
          className="drawer-backdrop"
          style={{ zIndex: 3000 }}
          onClick={() => {
            setCartOpen(false);
            setCheckoutOpen(false);
          }}
          role="presentation"
        >
          <aside
            className="cart-drawer"
            onClick={(e) => e.stopPropagation()}
            aria-label="Shopping Bag"
          >
            <div
              className="mobile-drawer-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'var(--forest-green)',
                color: '#fff',
                width: '100%',
                margin: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className="drawer-close-btn"
                  onClick={() => {
                    setCartOpen(false);
                    setCheckoutOpen(false);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    borderRadius: '4px',
                  }}
                  aria-label="Close cart drawer"
                >
                  <X size={20} />
                </button>
                <div>
                  <div
                    className="drawer-eyebrow"
                    style={{
                      color: 'var(--champagne-gold)',
                      fontSize: '10px',
                      letterSpacing: '0.2em',
                    }}
                  >
                    YOUR SELECTION
                  </div>
                  <div
                    className="drawer-title"
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '18px',
                      color: '#fff',
                    }}
                  >
                    {checkoutOpen ? 'Checkout Details' : `Shopping Bag (${totalCartItems})`}
                  </div>
                </div>
              </div>
            </div>

            {cart.length === 0 ? (
              <div
                className="empty-cart-pane"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '32px',
                  gap: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                <ShoppingBag size={40} strokeWidth={1.2} />
                <h4>Your Shopping Bag is Empty</h4>
                <p>Select a luxury piece from our catalog to begin your order.</p>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setCartOpen(false)}
                >
                  Browse Handbags
                </button>
              </div>
            ) : checkoutOpen ? (
              <form
                className="checkout-pane"
                onSubmit={handleInitializeCheckout}
                style={{
                  padding: '20px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  flex: 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setCheckoutOpen(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--forest-green)',
                      fontSize: '13px',
                      fontWeight: '600',
                      textAlign: 'left',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    ← Back to Bag Items
                  </button>
                </div>

                <h4>Lagos Dispatch Details</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Complete your handbag payment securely via Paystack. Our team will send your
                  exact rider fee &amp; pickup code after.
                </p>

                <div className="form-group">
                  <label>Delivery Area *</label>
                  <select
                    value={deliveryArea}
                    onChange={(e) => setDeliveryArea(e.target.value)}
                    required
                    style={{
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-alabaster)',
                      padding: '11px 12px',
                      fontSize: '14px',
                      width: '100%',
                    }}
                  >
                    {LAGOS_AREAS.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Full Street Address *</label>
                  <input
                    type="text"
                    required
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="House/Flat number, Street name, Estate"
                    style={{
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-alabaster)',
                      padding: '11px 12px',
                      fontSize: '14px',
                      width: '100%',
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Recipient Phone / WhatsApp *</label>
                  <input
                    type="tel"
                    required
                    value={deliveryPhone}
                    onChange={(e) => setDeliveryPhone(e.target.value)}
                    placeholder="0803 000 0000"
                    style={{
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-alabaster)',
                      padding: '11px 12px',
                      fontSize: '14px',
                      width: '100%',
                    }}
                  />
                </div>

                <div
                  style={{
                    background: 'var(--bg-alabaster)',
                    border: '1px solid var(--border-subtle)',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '13.5px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Handbags Subtotal</span>
                    <strong>₦{cartSubtotal.toLocaleString()}</strong>
                  </div>
                </div>

                <button type="submit" className="btn-primary full-width" disabled={checkingOut}>
                  {checkingOut
                    ? 'Redirecting to Paystack...'
                    : `Proceed to Paystack — ₦${cartSubtotal.toLocaleString()}`}
                </button>
              </form>
            ) : (
              <>
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  {cart.map((item) => (
                    <div
                      key={`${item.bag._id}-${item.selectedColor}`}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        padding: '12px',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-alabaster)',
                        alignItems: 'center',
                      }}
                    >
                      <img
                        src={resolveBagImage(item.bag.image || item.bag.images?.[0])}
                        alt={item.bag.name}
                        style={{ width: '68px', height: '76px', objectFit: 'cover' }}
                      />
                      <div style={{ flex: 1 }}>
                        <h5
                          style={{
                            fontFamily: 'var(--font-serif)',
                            fontSize: '15px',
                            color: 'var(--forest-green)',
                          }}
                        >
                          {item.bag.name}
                        </h5>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            margin: '2px 0 4px',
                          }}
                        >
                          Color: {item.selectedColor || 'Classic'}
                        </span>
                        <div style={{ fontWeight: '700', fontSize: '13.5px' }}>
                          ₦{(item.bag.price * item.qty).toLocaleString()}
                        </div>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            marginTop: '6px',
                            background: '#fff',
                            border: '1px solid var(--border-subtle)',
                            padding: '2px 8px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              item.qty > 1
                                ? handleAddToBag(item.bag, item.selectedColor, -1)
                                : handleRemoveFromCart(item.bag._id, item.selectedColor)
                            }
                            style={{
                              background: 'transparent',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Minus size={13} />
                          </button>
                          <span style={{ fontSize: '13px', fontWeight: '600' }}>{item.qty}</span>
                          <button
                            type="button"
                            onClick={() => handleAddToBag(item.bag, item.selectedColor, 1)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.bag._id, item.selectedColor)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    padding: '18px',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--bg-alabaster)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px' }}>
                    <span>Subtotal</span>
                    <strong>₦{cartSubtotal.toLocaleString()}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn-primary full-width"
                    onClick={() => setCheckoutOpen(true)}
                  >
                    PROCEED TO CHECKOUT
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {/* AUTH MODAL */}
      {authModalOpen && (
        <AuthModal
          initialMode={authInitialMode}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
          showToast={showToast}
        />
      )}

      {/* TOAST BANNER */}
      {toast && (
        <div className={`toast-banner ${toast.type === 'error' ? 'error' : 'success'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}