const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const fetchLagosDeliveryFee = async ({ streetAddress, area, cartItems }) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/delivery/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: 'Lagos',
        area,
        streetAddress,
        itemsCount: cartItems.reduce((sum, item) => sum + item.qty, 0),
      }),
    });

    if (!response.ok) {
      throw new Error('Live quote unavailable');
    }

    const data = await response.json();
    // Expects { fee: Number, provider: String, eta: String }
    return data;
  } catch {
    // Temporary preview fallback while Phase 2 backend/courier API key is pending
    const normalized = `${area} ${streetAddress}`.toLowerCase();
    let fallbackFee = 3500;

    if (normalized.includes('ajah') || normalized.includes('sangotedo') || normalized.includes('badagry') || normalized.includes('ikorodu')) {
      fallbackFee = 5500;
    } else if (normalized.includes('lekki') || normalized.includes('chevron') || normalized.includes('vgc') || normalized.includes('festac')) {
      fallbackFee = 4500;
    } else if (normalized.includes('yaba') || normalized.includes('surulere') || normalized.includes('gbagada')) {
      fallbackFee = 3000;
    }

    return {
      fee: fallbackFee,
      provider: 'Lagos Dispatch Estimate',
      eta: 'Same-day / Next-day Lagos Delivery',
    };
  }
};