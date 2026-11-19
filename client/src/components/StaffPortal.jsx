import React, { useState } from 'react';
import { Trash2, Video, Package, Pencil, X } from 'lucide-react';
import { apiRequest, resolveBagImage } from '../utils/api';

export default function StaffPortal({
  user,
  bags,
  collections,
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

  // Add / Edit Bag Form State
  const [editingBagId, setEditingBagId] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(collections[0]?.name || 'Tote Bags');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [description, setDescription] = useState('');
  const [colorName, setColorName] = useState('Classic');
  const [colorHex, setColorHex] = useState('#142B22');
  const [existingImages, setExistingImages] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [variants, setVariants] = useState([]);
  const [submittingBag, setSubmittingBag] = useState(false);

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

  const resetBagForm = () => {
    setEditingBagId(null);
    setName('');
    setCategory(collections[0]?.name || 'Tote Bags');
    setPrice('');
    setStock('1');
    setDescription('');
    setColorName('Classic');
    setColorHex('#142B22');
    setExistingImages([]);
    setImageFiles([]);
    setVariants([]);
  };

  const handleStartEditBag = (bag) => {
    setActiveTab('bags');
    setEditingBagId(bag._id);
    setName(bag.name || '');
    setCategory(bag.category || collections[0]?.name || 'Tote Bags');
    setPrice(bag.price !== undefined ? String(bag.price) : '');
    setStock(bag.stock !== undefined ? String(bag.stock) : '1');
    setDescription(bag.description || '');
    setColorName(bag.colorName || 'Classic');
    setColorHex(bag.colorHex || '#142B22');
    setExistingImages(
      [bag.image, ...(bag.images || [])].filter(Boolean).filter((val, idx, arr) => arr.indexOf(val) === idx)
    );
    setImageFiles([]);
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
    const hasExistingOrNewPrimaryPhoto = imageFiles.length > 0 || (editingBagId && existingImages.length > 0);

    if (!trimmedName || price === '' || !hasExistingOrNewPrimaryPhoto) {
      showToast('Please provide a handbag name, price, and at least 1 photo.', 'error');
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

      for (const file of imageFiles) {
        formData.append('imageFiles', file);
      }

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
        showToast('Handbag updated successfully!');
      } else {
        await apiRequest('/api/bags', { method: 'POST', body: formData }, onForceLogout);
        showToast('Handbag added successfully!');
      }

      resetBagForm();
      onRefreshBags();
    } catch (err) {
      showToast(err.message, 'error');
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
      onRefreshBags();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    try {
      await apiRequest('/api/collections', { method: 'POST', body: JSON.stringify({ name: newColName }) }, onForceLogout);
      showToast('Collection added.');
      setNewColName('');
      onRefreshCollections();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteCollection = async (id) => {
    if (!window.confirm('Delete this collection?')) return;
    try {
      await apiRequest(`/api/collections/${id}`, { method: 'DELETE' }, onForceLogout);
      showToast('Collection removed.');
      onRefreshCollections();
    } catch (err) {
      showToast(err.message, 'error');
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
      onRefreshSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingText(false);
    }
  };

  const handleUploadHeroMedia = async (file, isVideo = false) => {
    setUploadingHero(true);
    try {
      const formData = new FormData();
      formData.append(isVideo ? 'heroVideoFile' : 'heroFile', file);
      const endpoint = isVideo ? '/api/admin/settings/video' : '/api/admin/settings/hero';

      await apiRequest(endpoint, { method: 'POST', body: formData }, onForceLogout);
      showToast(isVideo ? 'Campaign video updated!' : 'Hero banner updated!');
      onRefreshSettings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingHero(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '1100px' }}>
      <div className="section-header-row" style={{ marginBottom: '24px' }}>
        <div>
          <span className="eyebrow-gold">STAFF &amp; INVENTORY PORTAL</span>
          <h1 className="editorial-heading">Boutique Management ({user.role})</h1>
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
                    onChange={(e) => handleUpdateVariantField(idx, 'files', Array.from(e.target.files))}
                    style={{ fontSize: '12px' }}
                  />
                </div>
              ))}
            </div>

            <div className="form-group">
              <label>
                Handbag Photos (Select up to 4) {editingBagId ? '(Leave empty to keep current photos)' : '*'}
              </label>
              {editingBagId && existingImages.length > 0 && imageFiles.length === 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {existingImages.map((img, i) => (
                    <img
                      key={i}
                      src={resolveBagImage(img)}
                      alt=""
                      style={{ width: '44px', height: '50px', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                    />
                  ))}
                </div>
              )}
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => setImageFiles(Array.from(e.target.files))}
                style={{ border: '1px solid var(--border-subtle)', padding: '8px', background: 'var(--bg-alabaster)' }}
              />
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
                  <img src={resolveBagImage(bag.image || bag.images?.[0])} alt="" style={{ width: '50px', height: '56px', objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '15px' }}>{bag.name}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {bag.category} • ₦{Number(bag.price).toLocaleString()} • Stock: {bag.stock}
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
                    {user.role === 'admin' && (
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
          <form onSubmit={handleCreateCollection} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '20px', display: 'flex', gap: '10px' }}>
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
              <div key={col._id || col.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '14px 18px' }}>
                <strong>{col.name}</strong>
                {user.role === 'admin' && (
                  <button type="button" onClick={() => handleDeleteCollection(col._id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
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
          <form onSubmit={handleSaveHeroText} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3>Upload Hero Media</h3>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px' }}>Campaign Video (MP4 / WebM)</label>
              <input
                type="file"
                accept="video/mp4,video/webm,video/mov"
                onChange={(e) => e.target.files[0] && handleUploadHeroMedia(e.target.files[0], true)}
                style={{ border: '1px solid var(--border-subtle)', padding: '8px', background: 'var(--bg-alabaster)', width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px' }}>Fallback / Poster Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files[0] && handleUploadHeroMedia(e.target.files[0], false)}
                style={{ border: '1px solid var(--border-subtle)', padding: '8px', background: 'var(--bg-alabaster)', width: '100%' }}
              />
            </div>

            {uploadingHero && <p style={{ fontSize: '13px', color: 'var(--champagne-gold)' }}>Uploading media to Cloudinary...</p>}
          </div>
        </div>
      )}
    </div>
  );
}