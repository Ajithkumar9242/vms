import React, { useEffect, useState, useCallback } from 'react';
import ParentLayout from '@/components/mobile/ParentLayout';
import useAuthStore from '@/store/authStore';
import { vaultAPI } from '@/services/api';

const ParentVault = () => {
  const user = useAuthStore((s) => s.user);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [msg, setMsg] = useState(null);

  // Modal states
  const [selected, setSelected] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [pendingRequest, setPendingRequest] = useState(null);

  // Form states
  const [studentId, setStudentId] = useState(null);
  const [copies, setCopies] = useState(1);
  const [parentNotes, setParentNotes] = useState('');

  // Extract student ID from user's linked entity
  useEffect(() => {
    const allLinked = user?.linkedEntity?.linkedStudents || user?.linkedStudents || [];
    const storedIdx = parseInt(localStorage.getItem('vms_selected_child_idx') || '0', 10);
    const safeIdx = allLinked.length > 0 ? Math.min(Math.max(0, storedIdx), allLinked.length - 1) : 0;
    const linked = allLinked[safeIdx];
    const sid = typeof linked === 'string' ? linked : linked?._id || null;
    if (sid) {
      setStudentId(sid);
    } else {
      setLoading(false);
    }
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await vaultAPI.getCatalog({ active: true });
      setCatalog(res.data || []);
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to load catalog' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRequest = async () => {
    if (!studentId) {
      setMsg({ type: 'error', text: 'No linked student found. Contact admin.' });
      return;
    }
    setRequesting(true);
    setMsg(null);
    try {
      const res = await vaultAPI.createRequest({ studentId, catalogItemId: selected._id, copies, parentNotes });
      const newRequest = res.data;

      setMsg({ type: 'success', text: `✅ Request ${newRequest.requestNumber} created successfully!` });
      setSelected(null);
      setPendingRequest(newRequest);
      setPayOpen(true);
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Request failed' });
    } finally {
      setRequesting(false);
    }
  };

  const handlePay = async () => {
    if (!pendingRequest) return;
    try {
      const orderRes = await vaultAPI.createPaymentOrder(pendingRequest._id);
      const order = orderRes.data;

      if (!window.Razorpay) {
        setMsg({ type: 'error', text: 'Payment gateway not loaded. Please try again.' });
        return;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'VMS School',
        description: `Document Request - ${pendingRequest.requestNumber}`,
        handler: async (resp) => {
          try {
            await vaultAPI.confirmPayment(pendingRequest._id, {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            setMsg({ type: 'success', text: '✅ Payment successful! Your request is now under review.' });
            setPayOpen(false);
            setPendingRequest(null);
          } catch (e) {
            setMsg({ type: 'error', text: e.message || 'Payment confirmation failed' });
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.phone || user?.linkedEntity?.phone
        },
        theme: { color: 'var(--color-primary)' },
      });
      rzp.open();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not initiate payment' });
    }
  };

  const CATEGORY_COLORS = {
    Certificate: { bg: 'var(--color-primary-light)', text: 'var(--color-primary-dark)' },
    Marks: { bg: 'var(--color-primary-light)', text: 'var(--color-primary-dark)' },
    Other: { bg: '#F0FDF4', text: '#15803D' }
  };

  return (
    <ParentLayout title="Document Vault" subtitle="Request official documents from school">

      {/* Messages */}
      {msg && (
        <div className={`m-alert m-alert-${msg.type === 'error' ? 'error' : 'success'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {loading && <div className="m-spinner" />}

      {!loading && catalog.length === 0 && (
        <div className="m-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>Vault is Empty</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>No documents are currently available to request.</div>
        </div>
      )}

      {/* Catalog List */}
      {!loading && catalog.map(item => {
        const catStyle = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.Other;
        return (
          <div key={item._id} className="m-card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{
                  background: catStyle.bg, color: catStyle.text,
                  padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, marginBottom: 8, display: 'inline-block'
                }}>
                  {item.category}
                </span>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
                  {item.name}
                </div>
                {item.description && (
                  <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                    {item.description}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>₹{item.price}</span>
                {item.requiresApproval && (
                  <span className="m-badge m-badge-warning" style={{ fontSize: 10 }}>Approval Required</span>
                )}
              </div>
            </div>

            <button
              className="m-btn m-btn-primary"
              style={{ width: '100%', marginTop: 14 }}
              onClick={() => { setSelected(item); setCopies(1); setParentNotes(''); }}
            >
              🛍️ Request Document
            </button>
          </div>
        );
      })}

      {/* Request Form Modal (Overlay) */}
      {selected && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div className="m-card" style={{ width: '100%', maxWidth: 400, margin: 0, padding: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>
              Request: {selected.name}
            </div>

            <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
              Price per copy: <strong style={{ color: '#0F172A' }}>₹{selected.price}</strong>
            </div>

            <div className="m-form-group">
              <label className="m-label">Number of Copies</label>
              <input
                type="number"
                className="m-input"
                min={1}
                max={selected.maxCopies}
                value={copies}
                onChange={e => setCopies(Number(e.target.value) || 1)}
              />
              {selected.maxCopies > 1 && (
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>Max {selected.maxCopies} copies allowed</div>
              )}
            </div>

            <div className="m-form-group" style={{ marginBottom: 16 }}>
              <label className="m-label">Notes (Optional)</label>
              <textarea
                className="m-input"
                rows={2}
                placeholder="Any specific instructions..."
                value={parentNotes}
                onChange={e => setParentNotes(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ background: 'var(--color-primary-light)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 14, color: '#334155' }}>Total Amount</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>
                  ₹{(selected.price * copies).toFixed(2)}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.4 }}>
                {selected.requiresApproval
                  ? '⚠ Payment required first; then admin reviews and approves.'
                  : '✓ No approval needed — file will be available after payment.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="m-btn m-btn-ghost" style={{ flex: 1 }} onClick={() => setSelected(null)} disabled={requesting}>
                Cancel
              </button>
              <button className="m-btn m-btn-primary" style={{ flex: 1 }} onClick={handleRequest} disabled={requesting}>
                {requesting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Prompt Modal (Overlay) */}
      {payOpen && pendingRequest && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div className="m-card" style={{ width: '100%', maxWidth: 400, margin: 0, padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
              Request Created
            </div>

            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16, lineHeight: 1.5 }}>
              Request <strong>{pendingRequest.requestNumber}</strong> has been submitted. <br />
              Total Amount: <strong style={{ color: 'var(--color-primary)', fontSize: 16 }}>₹{pendingRequest.netAmount}</strong>
            </div>

            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 20 }}>
              You can pay now to proceed, or visit <em>My Requests</em> later to complete the payment.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="m-btn m-btn-outline" style={{ flex: 1 }} onClick={() => { setPayOpen(false); setPendingRequest(null); }}>
                Pay Later
              </button>
              <button className="m-btn m-btn-primary" style={{ flex: 1, background: '#16A34A', borderColor: '#16A34A' }} onClick={handlePay}>
                Pay Now
              </button>
            </div>
          </div>
        </div>
      )}

    </ParentLayout>
  );
};

export default ParentVault;