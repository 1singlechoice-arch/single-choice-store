import { useState, useEffect } from 'react';
import { ArrowLeft, Mail, MapPin, Clock, Send, CheckCircle2, MessageCircle } from 'lucide-react';
import { apiRequest } from '../utils/api';

export default function ContactPage({ user, onBack }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('Product & Sizing Inquiry');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  useEffect(() => {
    if (user) {
      if (!name) setName(user.name || '');
      if (!email) setEmail(user.email || '');
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setFeedback({ type: '', text: '' });

    try {
      const res = await apiRequest('/api/contact', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, subject, message }),
      });
      setFeedback({ type: 'success', text: res.message });
      setMessage('');
      setPhone('');
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <main style={{ maxWidth: '1150px', margin: '0 auto', padding: '28px 24px 72px' }}>
      <button
        type="button"
        className="icon-btn"
        onClick={onBack}
        style={{ marginBottom: '24px', color: '#142B22', fontWeight: 600 }}
      >
        <ArrowLeft size={18} /> Back to Boutique
      </button>

      <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 44px' }}>
        <div
          style={{
            fontSize: '0.72rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#C5A059',
            fontWeight: 700,
            marginBottom: '10px',
          }}
        >
          Client Services
        </div>
        <h1 className="serif" style={{ fontSize: '2.4rem', color: '#142B22', marginBottom: '12px' }}>
          Contact Single Choice
        </h1>
        <p style={{ color: '#555', fontSize: '0.96rem', lineHeight: 1.7 }}>
          Have a question about handbag dimensions, color availability, bespoke sourcing, or your Lagos delivery? Our team is happy to assist.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
          gap: '36px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Boutique Contact Details */}
        <div
          style={{
            background: '#142B22',
            color: '#F4EFE6',
            padding: '36px 30px',
            border: '1px solid #C5A059',
          }}
        >
          <h2 className="serif" style={{ fontSize: '1.55rem', color: '#FFFFFF', marginBottom: '12px' }}>
            Boutique Concierge
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#D6CFC4', lineHeight: 1.7, marginBottom: '28px' }}>
            Every handbag in our collection is inspected before dispatch. Reach out directly for additional angle photos, gift packaging requests, or same-day Lagos dispatch inquiries.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <Mail size={19} style={{ color: '#C5A059', flexShrink: 0, marginTop: '3px' }} />
              <div>
                <div style={{ fontSize: '0.74rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C5A059', marginBottom: '3px' }}>
                  Email Concierge
                </div>
                <a
                  href="mailto:1singlechoice@gmail.com"
                  style={{ color: '#FFFFFF', textDecoration: 'none', fontSize: '0.95rem', fontWeight: 500 }}
                >
                  1singlechoice@gmail.com
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <MapPin size={19} style={{ color: '#C5A059', flexShrink: 0, marginTop: '3px' }} />
              <div>
                <div style={{ fontSize: '0.74rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C5A059', marginBottom: '3px' }}>
                  Dispatch Base
                </div>
                <div style={{ fontSize: '0.95rem', color: '#FFFFFF' }}>
                  Lagos, Nigeria
                </div>
                <div style={{ fontSize: '0.82rem', color: '#D6CFC4', marginTop: '2px' }}>
                  Same-day & next-day express delivery across Lagos
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <Clock size={19} style={{ color: '#C5A059', flexShrink: 0, marginTop: '3px' }} />
              <div>
                <div style={{ fontSize: '0.74rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C5A059', marginBottom: '3px' }}>
                  Client Support Hours
                </div>
                <div style={{ fontSize: '0.92rem', color: '#FFFFFF' }}>
                  Monday – Saturday: 9:00 AM – 7:00 PM
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <MessageCircle size={19} style={{ color: '#C5A059', flexShrink: 0, marginTop: '3px' }} />
              <div>
                <div style={{ fontSize: '0.74rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#C5A059', marginBottom: '3px' }}>
                  Response Time
                </div>
                <div style={{ fontSize: '0.9rem', color: '#D6CFC4' }}>
                  We typically respond within 2 hours during boutique hours.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Direct Message Form */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E2D9', padding: '36px 32px' }}>
          <h3 className="serif" style={{ fontSize: '1.5rem', color: '#142B22', marginBottom: '6px' }}>
            Send Us a Message
          </h3>
          <p style={{ fontSize: '0.86rem', color: '#666', marginBottom: '22px' }}>
            Complete the form below and we will reply directly to your email.
          </p>

          {feedback.text && (
            <div
              style={{
                background: feedback.type === 'success' ? '#EDF7ED' : '#FDECEA',
                borderLeft: `4px solid ${feedback.type === 'success' ? '#1B6B3A' : '#9B2226'}`,
                color: feedback.type === 'success' ? '#142B22' : '#9B2226',
                padding: '14px 16px',
                fontSize: '0.88rem',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              {feedback.type === 'success' && <CheckCircle2 size={18} style={{ color: '#1B6B3A', flexShrink: 0 }} />}
              <span>{feedback.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#142B22', marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', border: '1px solid #D6CFC4', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#142B22', marginBottom: '6px' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', border: '1px solid #D6CFC4', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#142B22', marginBottom: '6px' }}>
                  Phone / WhatsApp (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 0801 234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', border: '1px solid #D6CFC4', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#142B22', marginBottom: '6px' }}>
                  Topic
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', border: '1px solid #D6CFC4', background: '#FFF', fontSize: '0.9rem' }}
                >
                  <option value="Product & Sizing Inquiry">Product & Sizing Inquiry</option>
                  <option value="Order & Delivery Status">Order & Delivery Status</option>
                  <option value="Color Restock Request">Color Restock Request</option>
                  <option value="General Question">General Question</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#142B22', marginBottom: '6px' }}>
                Your Message *
              </label>
              <textarea
                rows="5"
                required
                placeholder="Tell us which handbag or order you need help with..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '11px 12px',
                  border: '1px solid #D6CFC4',
                  fontFamily: 'inherit',
                  fontSize: '0.92rem',
                  lineHeight: 1.6,
                }}
              />
            </div>

            <button
              type="submit"
              className="btn-forest"
              disabled={sending}
              style={{
                padding: '14px 24px',
                fontSize: '0.88rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <Send size={16} />
              <span>{sending ? 'Sending Message...' : 'Send Message'}</span>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}