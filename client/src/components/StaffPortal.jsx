import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Video, Package, Pencil, X, ArrowUp, ArrowDown } from 'lucide-react';
import { apiRequest, resolveBagImage } from '../utils/api';

const MAX_PHOTO_SLOTS = 4;
const SLOT_LABELS = ['1st (Cover)', '2nd', '3rd', '4th'];

function createEmptySlots() {
  return Array.from({ length: MAX_PHOTO_SLOTS }, () => ({
    existingUrl: '',
    file: null,
    previewUrl: '',
  }));
}

export default function StaffPortal({
  user,
  bags = [],
  collections = [],
  heroImage,
  heroVideo,
  heroEyebrow,
  heroTitle,
  heroSubtitle,
  heroCtaText,
  onRefreshBags,
  onRefreshCollections,
  onRefreshSettings,
  onBackToStore,
  showToast,
  onForceLogout,
}) {
  const [activeTab, setActiveTab] = useState('bags'); // 'bags' | 'collections' | 'hero'

  const defaultCategory = collections[0]?.name || 'Tote Bags';

  // Add / Edit Bag Form State
  const [editingBagId, setEditingBagId] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [description, setDescription] = useState('');
  const [colorName, setColorName] = useState('Classic');
  const [colorHex, setColorHex] = useState('#142B22');
  const [photoSlots, setPhotoSlots] = useState(() => createEmptySlots());
  const [variants, setVariants] = useState([]);
  const [submittingBag, setSubmittingBag] = useState(false);

  const slotInputRefs = useRef([]);

  // New Collection State
  const [newColName, setNewColName] = useState('');

  // Hero Text Settings State
  const [eyebrowInput, setEyebrowInput] = useState(heroEyebrow || '');
  const [titleInput, setTitleInput] = useState(heroTitle || '');
  const [subtitleInput, setSubtitleInput] = useState(heroSubtitle || '');
  const [ctaInput, setCtaInput] = useState(heroCtaText || '');
  const [savingText, setSavingText] = useState(false);

  // Media Upload State
  const [uploadingHero, setUploadingHero] = useState(false);

  useEffect(() => {
    if (!editingBagId && collections.length > 0) {
      setCategory((prev) =>
        collections.some((c) => c.name === prev) ? prev : collections[0].name
      );
    }
  }, [collections, editingBagId]);

  useEffect(() => {
    setEyebrowInput(heroEyebrow || '');
  }, [heroEyebrow]);

  useEffect(() => {
    setTitleInput(heroTitle || '');
  }, [heroTitle]);

  useEffect(() => {
    setSubtitleInput(heroSubtitle || '');
  }, [heroSubtitle]);

  useEffect(() => {
    setCtaInput(heroCtaText || '');
  }, [heroCtaText]);

  const clearObjectUrls = (slots) => {
    slots.forEach((slot) => {
      if (slot.previewUrl) {
        URL.revokeObjectURL(slot.previewUrl);
      }
    });
  };

  useEffect(() => {
    return () => {
      clearObjectUrls(photoSlots);
    };
  }, [photoSlots]);

  const resetSlotFileInput = (slotIdx) => {
    const inputEl = slotInputRefs.current[slotIdx];
    if (inputEl) {
      inputEl.value = '';
    }
  };

  const resetBagForm = () => {
    clearObjectUrls(photoSlots);
    setEditingBagId(null);
    setName('');
    setCategory(collections[0]?.name || 'Tote Bags');
    setPrice('');
    setStock('1');
    setDescription('');
    setColorName('Classic');
    setColorHex('#142B22');
    setPhotoSlots(createEmptySlots());
    setVariants([]);
    slotInputRefs.current.forEach((el) => {
      if (el) el.value = '';
    });
  };

  const handleStartEditBag = (bag) => {
    clearObjectUrls(photoSlots);
    setActiveTab('bags');
    setEditingBagId(bag._id);
    setName(bag.name || '');
    setCategory(bag.category || collections[0]?.name || 'Tote Bags');
    setPrice(bag.price !== undefined && bag.price !== null ? String(bag.price) : '');
    setStock(bag.stock !== undefined && bag.stock !== null ? String(bag.stock) : '1');
    setDescription(bag.description || '');
    setColorName(bag.colorName || 'Classic');
    setColorHex(bag.colorHex || '#142B22');

    const uniqueExisting = [bag.image, ...(bag.images || [])]
      .filter(Boolean)
      .filter((val, idx, arr) => arr.indexOf(val) === idx)
      .slice(0, MAX_PHOTO_SLOTS);

    const nextSlots = createEmptySlots();
    uniqueExisting.forEach((url, idx) => {
      nextSlots[idx] = {
        existingUrl: url,
        file: null,
        previewUrl: '',
      };
    });
    setPhotoSlots(nextSlots);

    setVariants(
      Array.isArray(bag.variants)
        ? bag.variants.map((v) => ({
            colorName: v.colorName || '',
            colorHex: v.colorHex || '#142B22',
            stock: v.stock !== undefined ? String(v.stock) : '1',
            image: v.image || '',
            images: Array.isArray(v.images) ? v.images : v.image ? [v.image] : [],
            files: [],
          }))
        : []
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectSlotFile = (slotIdx, file) => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPhotoSlots((prev) =>
      prev.map((slot, idx) => {
        if (idx !== slotIdx) return slot;
        if (slot.previewUrl) {
          URL.revokeObjectURL(slot.previewUrl);
        }
        return {
          existingUrl: '',
          file,
          previewUrl: objectUrl,
        };
      })
    );
  };

  const handleClearSlot = (slotIdx) => {
    setPhotoSlots((prev) =>
      prev.map((slot, idx) => {
        if (idx !== slotIdx) return slot;
        if (slot.previewUrl) {
          URL.revokeObjectURL(slot.previewUrl);
        }
        return {
          existingUrl: '',
          file: null,
          previewUrl: '',
        };
      })
    );
    resetSlotFileInput(slotIdx);
  };

  const handleSwapSlots = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= MAX_PHOTO_SLOTS) return;
    setPhotoSlots((prev) => {
      const copy = [...prev];
      const temp = copy[fromIdx];
      copy[fromIdx] = copy[toIdx];
      copy[toIdx] = temp;
      return copy;
    });
  };

  const handleAddVariantRow = () => {
    setVariants((prev) => [
      ...prev,
      { colorName: '', colorHex: '#6E2639', stock: '1', image: '', images: [], files: [] },
    ]);
  };

  const handleUpdateVariantField = (idx, field, value) => {
    setVariants((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveVariantRow = (idx) => {
    setVariants((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveBag = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const orderedSlots = photoSlots.filter((s) => Boolean(s.file || s.existingUrl));
    const orderedFiles = orderedSlots.map((s) => s.file).filter(Boolean);
    const orderedExistingUrls = orderedSlots.map((s) => s.existingUrl).filter(Boolean);

    if (!trimmedName || price === '' || orderedSlots.length === 0) {
      showToast('Please provide a handbag name, price, and at least 1 photo in slots 1–4.', 'error');
      return;
    }

    setSubmittingBag(true);
    try {
      const formData = new FormData();
      formData.append('name', trimmedName);
      formData.append('category', category);
      formData.append('price', price);
      formData.append('stock', stock);
      formData.append('description', description);
      formData.append('colorName', (colorName || 'Classic').trim());
      formData.append('colorHex', colorHex || '#142B22');

      orderedFiles.forEach((file) => {
        formData.append('imageFiles', file);
      });

      formData.append('existingImagesJson', JSON.stringify(orderedExistingUrls));
      formData.append(
        'photoOrderJson',
        JSON.stringify(
          orderedSlots.map((slot, idx) => ({
            position: idx + 1,
            source: slot.file ? 'upload' : 'existing',
            url: slot.existingUrl || '',
            fileName: slot.file ? slot.file.name : '',
          }))
        )
      );

      const validVariants = variants.filter((v) => (v.colorName || '').trim());
      const serializedVariants = validVariants.map((v, idx) => {
        if (Array.isArray(v.files) && v.files.length > 0) {
          for (const f of v.files) {
            formData.append(`variantFiles_${idx}`, f);
          }
        }
        return {
          colorName: v.colorName.trim(),
          colorHex: v.colorHex || '#142B22',
          stock: Number(v.stock ?? 1),
          image: v.image || '',
          images: Array.isArray(v.images) ? v.images : [],
        };
      });
      formData.append('variantsJson', JSON.stringify(serializedVariants));

      if (editingBagId) {
        await apiRequest(`/api/bags/${editingBagId}`, { method: 'PUT', body: formData }, onForceLogout);
        showToast('Handbag updated with your selected photo order!');
      } else {
        await apiRequest('/api/bags', { method: 'POST', body: formData }, onForceLogout);
        showToast('Handbag published with your selected photo order!');
      }

      resetBagForm();
      if (typeof onRefreshBags === 'function') {
        onRefreshBags();
      }
    } catch (err) {
      showToast(err.message || 'Failed to save handbag.', 'error');
    } finally {
      setSubmittingBag(false);
    }
  };

  const handleDeleteBag = async (id) => {
    if (!window.confirm('Delete this handbag?')) return;
    try {
      await apiRequest(`/api/bags/${id}`, { method: 'DELETE' }, onForceLogout);
      if (editingBagId === id) {
        resetBagForm();
      }
      showToast('Handbag removed.');
      if (typeof onRefreshBags === 'function') {
        onRefreshBags();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete handbag.', 'error');
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    try {
      await apiRequest(
        '/api/collections',
        { method: 'POST', body: JSON.stringify({ name: newColName.trim() }) },
        onForceLogout
      );
      showToast('Collection added.');
      setNewColName('');
      if (typeof onRefreshCollections === 'function') {
        onRefreshCollections();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create collection.', 'error');
    }
  };

  const handleDeleteCollection = async (id) => {
    if (!window.confirm('Delete this collection?')) return;
    try {
      await apiRequest(`/api/collections/${id}`, { method: 'DELETE' }, onForceLogout);
      showToast('Collection removed.');
      if (typeof onRefreshCollections === 'function') {
        onRefreshCollections();
      }
    } catch (err) {
      showToast(err.message || 'Failed to delete collection.', 'error');
    }
  };

  const handleSaveHeroText = async (e) => {
    e.preventDefault();
    setSavingText(true);
    try {
      await apiRequest(
        '/api/admin/settings/text',
        {
          method: 'PUT',
          body: JSON.stringify({
            heroEyebrow: eyebrowInput,
            heroTitle: titleInput,
            heroSubtitle: subtitleInput,
            heroCtaText: ctaInput,
          }),
        },
        onForceLogout
      );
      showToast('Hero campaign text updated successfully!');
      if (typeof onRefreshSettings === 'function') {
        onRefreshSettings();
      }
    } catch (err) {
      showToast(err.message || 'Failed to save campaign text.', 'error');
    } finally {
      setSavingText(false);
    }
  };

  const handleUploadHeroMedia = async (file, isVideo = false) => {
    if (!file) return;
    setUploadingHero(true);
    try {
      const formData = new FormData();
      formData.append(isVideo ? 'heroVideoFile' : 'heroFile', file);
      const endpoint = isVideo ? '/api/admin/settings/video' : '/api/admin/settings/hero';

      await apiRequest(endpoint, { method: 'POST', body: formData }, onForceLogout);
      showToast(isVideo ? 'Campaign video updated!' : 'Hero banner updated!');
      if (typeof onRefreshSettings === 'function') {
        onRefreshSettings();
      }
    } catch (err) {
      showToast(err.message || 'Failed to upload media.', 'error');
    } finally {
      setUploadingHero(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '1100px' }}>
      <div className="section-header-row" style={{ marginBottom: '24px' }}>
        <div>
          <span className="eyebrow-gold">STAFF &amp; INVENTORY PORTAL</span>
          <h1 className="editorial-heading">Boutique Management ({user?.role || 'staff'})</h1>
        </div>
        <button type="button" className="btn-secondary" onClick={onBackToStore}>
          ← Back to Storefront
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`pill-btn ${activeTab === 'bags' ? 'active' : ''}`}
          onClick={() => setActiveTab('bags')}
        >
          <Package size={16} style={{ display: 'inline', marginRight: '6px' }} /> Handbag Catalog ({bags.length})
        </button>
        <button
          type="button"
          className={`pill-btn ${activeTab === 'collections' ? 'active' : ''}`}
          onClick={() => setActiveTab('collections')}
        >
          Collections ({collections.length})
        </button>
        <button
          type="button"
          className={`pill-btn ${activeTab === 'hero' ? 'active' : ''}`}
          onClick={() => setActiveTab('hero')}
        >
          <Video size={16} style={{ display: 'inline', marginRight: '6px' }} /> Homepage Hero &amp; Text
        </button>
      </div>

      {activeTab === 'bags' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '28px' }} className="admin-grid">
          <form
            onSubmit={handleSaveBag}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{editingBagId ? 'Edit Handbag' : 'Add New Handbag'}</h3>
              {editingBagId && (
                <button
                  type="button"
                  onClick={resetBagForm}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    padding: '4px 10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} /> Cancel Edit
                </button>
              )}
            </div>

            <div className="form-group">
              <label>Handbag Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chris Bella Classic Tote"
                style={{ border: '1px solid var(--border-subtle)', padding: '10px', background: 'var(--bg-alabaster)' }}
              />
            </div>

            <div className="form-group">
              <label>Collection Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ border: '1px solid var(--border-subtle)', padding: '10px', background: 'var(--bg-alabaster)' }}
              >
                {collections.map((col) => (
                  <option key={col._id || col.name} value={col.name}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Price (₦) *</label>
              <input
                type="number"
                required
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150000"
                style={{ border: '1px solid var(--border-subtle)', padding: '10px', background: 'var(--bg-alabaster)' }}
              />
            </div>

            <div className="form-group">
              <label>Stock Quantity *</label>
              <input
                type="number"
                required
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="5"
                style={{ border: '1px solid var(--border-subtle)', padding: '10px', background: 'var(--bg-alabaster)' }}
              />
            </div>

            <div className="form-group">
              <label>Primary Color Name &amp; Swatch</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={colorName}
                  onChange={(e) => setColorName(e.target.value)}
                  placeholder="e.g. Saddle Brown"
                  style={{ border: '1px solid var(--border-subtle)', padding: '10px', background: 'var(--bg-alabaster)', flex: 1 }}
                />
                <input
                  type="color"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  style={{ width: '44px', height: '42px', border: '1px solid var(--border-subtle)', background: 'transparent', cursor: 'pointer' }}
                />
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ margin: 0 }}>Additional Color Variants (Optional)</label>
                <button
                  type="button"
                  onClick={handleAddVariantRow}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  + Add Color
                </button>
              </div>

              {variants.map((v, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-alabaster)',
                    padding: '10px',
                    marginBottom: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={v.colorName}
                      onChange={(e) => handleUpdateVariantField(idx, 'colorName', e.target.value)}
                      placeholder="Color name (e.g. Burgundy)"
                      style={{ border: '1px solid var(--border-subtle)', padding: '7px', background: '#fff', flex: 1, fontSize: '13px' }}
                    />
                    <input
                      type="color"
                      value={v.colorHex || '#142B22'}
                      onChange={(e) => handleUpdateVariantField(idx, 'colorHex', e.target.value)}
                      style={{ width: '36px', height: '34px', border: '1px solid var(--border-subtle)', background: 'transparent' }}
                    />
                    <input
                      type="number"
                      min="0"
                      value={v.stock}
                      onChange={(e) => handleUpdateVariantField(idx, 'stock', e.target.value)}
                      placeholder="Qty"
                      style={{ width: '68px', border: '1px solid var(--border-subtle)', padding: '7px', background: '#fff', fontSize: '13px' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveVariantRow(idx)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      title="Remove color variant"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleUpdateVariantField(idx, 'files', Array.from(e.target.files || []))}
                    style={{ fontSize: '12px' }}
                  />
                </div>
              ))}
            </div>

            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '6px' }}>
                Handbag Photo Order (Pick 1st, 2nd, 3rd, 4th) *
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {photoSlots.map((slot, slotIdx) => {
                  const displaySrc = slot.previewUrl
                    ? slot.previewUrl
                    : slot.existingUrl
                    ? resolveBagImage(slot.existingUrl)
                    : '';

                  return (
                    <div
                      key={slotIdx}
                      style={{
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-alabaster)',
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            minWidth: '72px',
                            color: 'var(--forest-green)',
                          }}
                        >
                          {SLOT_LABELS[slotIdx]}
                        </span>

                        {displaySrc ? (
                          <img
                            src={displaySrc}
                            alt={`${SLOT_LABELS[slotIdx]} photo`}
                            style={{
                              width: '38px',
                              height: '44px',
                              objectFit: 'cover',
                              border: '1px solid var(--border-subtle)',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '38px',
                              height: '44px',
                              border: '1px dashed var(--border-subtle)',
                              background: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              flexShrink: 0,
                            }}
                          >
                            #{slotIdx + 1}
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                          <input
                            ref={(el) => {
                              slotInputRefs.current[slotIdx] = el;
                            }}
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const picked = e.target.files?.[0];
                              if (picked) {
                                handleSelectSlotFile(slotIdx, picked);
                              }
                            }}
                            style={{ fontSize: '11px', maxWidth: '100%' }}
                          />
                          {slot.file && (
                            <span
                              style={{
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {slot.file.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          type="button"
                          disabled={slotIdx === 0}
                          onClick={() => handleSwapSlots(slotIdx, slotIdx - 1)}
                          title="Move up"
                          style={{
                            background: '#fff',
                            border: '1px solid var(--border-subtle)',
                            padding: '4px',
                            cursor: slotIdx === 0 ? 'not-allowed' : 'pointer',
                            opacity: slotIdx === 0 ? 0.4 : 1,
                          }}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={slotIdx === MAX_PHOTO_SLOTS - 1}
                          onClick={() => handleSwapSlots(slotIdx, slotIdx + 1)}
                          title="Move down"
                          style={{
                            background: '#fff',
                            border: '1px solid var(--border-subtle)',
                            padding: '4px',
                            cursor: slotIdx === MAX_PHOTO_SLOTS - 1 ? 'not-allowed' : 'pointer',
                            opacity: slotIdx === MAX_PHOTO_SLOTS - 1 ? 0.4 : 1,
                          }}
                        >
                          <ArrowDown size={13} />
                        </button>
                        {(slot.file || slot.existingUrl) && (
                          <button
                            type="button"
                            onClick={() => handleClearSlot(slotIdx)}
                            title="Clear slot"
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--danger)',
                              cursor: 'pointer',
                              padding: '4px',
                            }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Crafted from Italian calfskin..."
                style={{ border: '1px solid var(--border-subtle)', padding: '10px', background: 'var(--bg-alabaster)' }}
              />
            </div>

            <button type="submit" className="btn-primary full-width" disabled={submittingBag}>
              {submittingBag
                ? editingBagId
                  ? 'Saving Changes...'
                  : 'Uploading Handbag...'
                : editingBagId
                ? 'Save Handbag Changes'
                : 'Publish Handbag'}
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3>Existing Catalog ({bags.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '680px', overflowY: 'auto' }}>
              {bags.map((bag) => (
                <div
                  key={bag._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-card)',
                    border: editingBagId === bag._id ? '1.5px solid var(--forest-green)' : '1px solid var(--border-subtle)',
                    padding: '12px',
                    gap: '12px',
                  }}
                >
                  <img
                    src={resolveBagImage(bag.image || bag.images?.[0])}
                    alt={bag.name || 'Handbag'}
                    style={{ width: '50px', height: '56px', objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px' }}>{bag.name}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {bag.category} • ₦{Number(bag.price || 0).toLocaleString()} • Stock: {bag.stock}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleStartEditBag(bag)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--forest-green)',
                        padding: '6px 10px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      title="Edit Handbag"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    {user?.role === 'admin' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBag(bag._id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        title="Delete Handbag"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'collections' && (
        <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <form
            onSubmit={handleCreateCollection}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '20px', display: 'flex', gap: '10px' }}
          >
            <input
              type="text"
              required
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              placeholder="New collection name (e.g. Evening Silhouettes)"
              style={{ border: '1px solid var(--border-subtle)', padding: '10px', background: 'var(--bg-alabaster)', flex: 1 }}
            />
            <button type="submit" className="btn-primary">Add Collection</button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {collections.map((col) => (
              <div
                key={col._id || col.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  padding: '14px 18px',
                }}
              >
                <strong>{col.name}</strong>
                {user?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCollection(col._id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'hero' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px' }}>
          <form
            onSubmit={handleSaveHeroText}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <h3>Edit Campaign Banner Text</h3>
            <div className="form-group">
              <label>Hero Eyebrow (Small Tagline)</label>
              <input
                type="text"
                value={eyebrowInput}
                onChange={(e) => setEyebrowInput(e.target.value)}
                style={{ border: '1px solid var(--border-subtle)', padding: '10px', background: 'var(--bg-alabaster)' }}
              />
            </div>
            <div className="form-group">
              <label>Hero Main Title</label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                style={{ border: '1px solid var(--border-subtle)', padding: '10px', background: 'var(--bg-alabaster)' }}
              />
            </div>
            <div className="form-group">
              <label>Hero Subtitle Description</label>
              <textarea
                rows={3}
                value={subtitleInput}
                onChange={(e) => setSubtitleInput(e.target.value)}
                style={{ border: '1px solid var(--border-subtle)', padding: '10px', background: 'var(--bg-alabaster)' }}
              />
            </div>
            <div className="form-group">
              <label>Explore Button Text</label>
              <input
                type="text"
                value={ctaInput}
                onChange={(e) => setCtaInput(e.target.value)}
                style={{ border: '1px solid var(--border-subtle)', padding: '10px', background: 'var(--bg-alabaster)' }}
              />
            </div>
            <button type="submit" className="btn-primary full-width" disabled={savingText}>
              {savingText ? 'Saving Text...' : 'Save Campaign Text'}
            </button>
          </form>

          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <h3>Upload Hero Media</h3>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px' }}>
                Campaign Video (MP4 / WebM)
              </label>
              <input
                type="file"
                accept="video/mp4,video/webm,video/mov"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadHeroMedia(file, true);
                  e.target.value = '';
                }}
                style={{ border: '1px solid var(--border-subtle)', padding: '8px', background: 'var(--bg-alabaster)', width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px' }}>
                Fallback / Poster Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadHeroMedia(file, false);
                  e.target.value = '';
                }}
                style={{ border: '1px solid var(--border-subtle)', padding: '8px', background: 'var(--bg-alabaster)', width: '100%' }}
              />
            </div>

            {(heroVideo || heroImage) && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {heroVideo && <div>Active campaign video configured</div>}
                {heroImage && <div>Active poster image configured</div>}
              </div>
            )}

            {uploadingHero && (
              <p style={{ fontSize: '13px', color: 'var(--champagne-gold)' }}>Uploading media to Cloudinary...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}