import { useState, useEffect, useRef } from 'react';
import { MapPin, Search, Loader2, CheckCircle2 } from 'lucide-react';

// Bounding box covering all of Nigeria (minLon, minLat, maxLon, maxLat)
const NIGERIA_BBOX = '2.65,4.25,14.68,13.90';

export default function LagosAddressAutocomplete({
  lagosArea,
  streetAddress,
  onSelectLocation,
  onManualChange,
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search locations across Nigeria as user types (debounced 350ms)
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const searchTerm = trimmed.toLowerCase().includes('nigeria')
          ? trimmed
          : `${trimmed}, Nigeria`;

        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          searchTerm
        )}&bbox=${NIGERIA_BBOX}&limit=7`;

        const res = await fetch(url);
        const data = await res.json();

        const formatted = (data.features || []).map((feature) => {
          const p = feature.properties || {};
          const [lon, lat] = feature.geometry?.coordinates || [3.3792, 6.5244];

          const primary =
            [p.housenumber, p.street || p.name].filter(Boolean).join(' ') ||
            p.district ||
            p.locality ||
            'Delivery Location';

          const areaParts = [
            p.district || p.suburb || p.locality || p.city || p.county,
            p.state,
          ].filter((val, idx, arr) => val && arr.indexOf(val) === idx);

          const area = areaParts.join(', ') || 'Lagos';

          const fullLabel = [primary, ...areaParts]
            .filter((val, idx, arr) => val && arr.indexOf(val) === idx)
            .join(', ');

          return {
            id: `${p.osm_id || Math.random()}-${lat}-${lon}`,
            primary,
            area,
            fullLabel,
            lat,
            lon,
          };
        });

        setSuggestions(formatted);
        setShowDropdown(true);
      } catch (err) {
        console.error('Map search error:', err);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const handlePickSuggestion = (item) => {
    setQuery(item.fullLabel);
    setShowDropdown(false);
    setSelectedPin({ lat: item.lat, lon: item.lon, label: item.fullLabel });
    onSelectLocation({
      area: item.area,
      streetAddress: item.primary,
      lat: item.lat,
      lon: item.lon,
    });
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', marginBottom: '10px' }}>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: '#142B22',
          marginBottom: '6px',
        }}
      >
        <MapPin size={15} /> Search Delivery Address (Nationwide)
      </label>

      {/* Live Autocomplete Input */}
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#777',
          }}
        />
        <input
          type="text"
          placeholder="Type street, estate, city, or state..."
          value={query}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedPin(null);
            onManualChange();
          }}
          style={{
            width: '100%',
            padding: '9px 30px 9px 30px',
            border: '1px solid #142B22',
            background: '#FFF',
            fontSize: '0.85rem',
            marginBottom: '8px',
          }}
        />
        {searching && (
          <Loader2
            size={14}
            style={{
              position: 'absolute',
              right: '10px',
              top: '38%',
              transform: 'translateY(-50%)',
              color: '#142B22',
            }}
          />
        )}
      </div>

      {/* Autocomplete Suggestions Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '64px',
            left: 0,
            right: 0,
            background: '#FFF',
            border: '1px solid #142B22',
            boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
            zIndex: 50,
            maxHeight: '210px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handlePickSuggestion(item)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '9px 12px',
                background: '#FFF',
                border: 'none',
                borderBottom: '1px solid #EFEAE2',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF8F5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#FFF')}
            >
              <MapPin size={14} style={{ color: '#C5A059', marginTop: '3px', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.83rem', fontWeight: 600, color: '#142B22' }}>
                  {item.primary}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#666' }}>{item.fullLabel}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Confirmed / Editable City/State & House Number */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <input
          type="text"
          placeholder="City / State (e.g. Lekki, Abuja, PH)"
          value={lagosArea}
          onChange={(e) => onManualChange('area', e.target.value)}
          style={{
            width: '100%',
            padding: '8px 9px',
            border: '1px solid #D6CFC4',
            background: '#FFF',
            fontSize: '0.82rem',
          }}
        />
        <input
          type="text"
          placeholder="House No. & Street"
          value={streetAddress}
          onChange={(e) => onManualChange('streetAddress', e.target.value)}
          style={{
            width: '100%',
            padding: '8px 9px',
            border: '1px solid #D6CFC4',
            background: '#FFF',
            fontSize: '0.82rem',
          }}
        />
      </div>

      {/* Live Map Pin Preview when an address is selected */}
      {selectedPin && (
        <div style={{ marginBottom: '8px', border: '1px solid #D6CFC4', background: '#FFF' }}>
          <div
            style={{
              padding: '5px 8px',
              fontSize: '0.73rem',
              color: '#1B6B3A',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: '#F4F9F5',
            }}
          >
            <CheckCircle2 size={13} /> Pinned on Map
          </div>
          <iframe
            title="Delivery Location Pin"
            width="100%"
            height="130"
            style={{ border: 0, display: 'block' }}
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${
              selectedPin.lon - 0.008
            }%2C${selectedPin.lat - 0.006}%2C${selectedPin.lon + 0.008}%2C${
              selectedPin.lat + 0.006
            }&layer=mapnik&marker=${selectedPin.lat}%2C${selectedPin.lon}`}
          />
        </div>
      )}
    </div>
  );
}