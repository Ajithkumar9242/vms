import React, { useEffect, useState, useCallback } from 'react';
import ParentLayout from '@/components/mobile/ParentLayout';
import useAuthStore from '@/store/authStore';
import { vaultAPI } from '@/services/api';
import dayjs from 'dayjs';

const PAY_BADGE = {
  unpaid: { label: 'Unpaid', class: 'm-badge-danger' },
  paid: { label: 'Paid', class: 'm-badge-success' },
  refunded: { label: 'Refunded', class: 'm-badge-warning' },
};

const ParentDocumentRequests = () => {
  const user = useAuthStore((s) => s.user);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [studentId, setStudentId] = useState(null);

  // Extract student ID from user's linked entity
  useEffect(() => {
    const linked = user?.linkedEntity?.linkedStudents?.[0] || user?.linkedStudents?.[0];
    const sid = typeof linked === 'string' ? linked : linked?._id || null;
    if (sid) {
      setStudentId(sid);
    } else {
      setLoading(false); // No student linked
    }
  }, [user]);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await vaultAPI.getMyRequests({ studentId });
      setRequests(res.data || []);
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Failed to load requests' });
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePay = async (req) => {
    try {
      const orderRes = await vaultAPI.createPaymentOrder(req._id);
      const order = orderRes.data;

      if (!window.Razorpay) {
        setMsg({ type: 'error', text: 'Payment gateway not available. Please try again later.' });
        return;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'VMS School',
        description: `Document Request - ${req.requestNumber}`,
        handler: async (resp) => {
          try {
            await vaultAPI.confirmPayment(req._id, {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature
            });
            setMsg({ type: 'success', text: '✅ Payment confirmed successfully!' });
            load();
          } catch (e) {
            setMsg({ type: 'error', text: e.message || 'Payment confirmation failed' });
          }
        },
        theme: { color: '#2563EB' },
      });
      rzp.open();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not initiate payment' });
    }
  };

  return (
    <ParentLayout title="My Requests" subtitle="Track your document requests">

      {/* Messages */}
      {msg && (
        <div className={`m-alert m-alert-${msg.type === 'success' ? 'success' : 'error'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {loading && <div className="m-spinner" />}

      {!loading && requests.length === 0 && (
        <div className="m-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>No requests yet</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Go to the Vault to request a new document.</div>
        </div>
      )}

      {!loading && requests.map(req => {
        const payInfo = PAY_BADGE[req.paymentStatus] || PAY_BADGE.unpaid;
        const canDownload = req.requestStatus === 'fulfilled' && req.paymentStatus === 'paid' && req.linkedVaultFileId;
        const steps = ['requested', 'approved', 'fulfilled'];

        return (
          <div key={req._id} className="m-card" style={{ marginBottom: 12 }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ color: '#0F172A', fontWeight: 700, fontSize: 15 }}>
                  {req.catalogItemId?.name || 'Document Request'}
                </div>
                <div style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
                  {req.requestNumber} &nbsp;•&nbsp; {dayjs(req.createdAt).format('DD MMM YYYY')}
                </div>
              </div>
              <span className={`m-badge ${payInfo.class}`}>
                {payInfo.label}
              </span>
            </div>

            {/* Timeline */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', background: '#F8FAFC', padding: '10px 14px', borderRadius: 8 }}>
              {steps.map((step) => {
                const active = req.requestStatus === step;
                const done = steps.indexOf(req.requestStatus) > steps.indexOf(step);
                const isRejected = req.requestStatus === 'rejected';

                // If rejected, override the timeline visuals
                const color = isRejected ? '#EF4444' : (done || active ? '#22C55E' : '#CBD5E1');
                const bgColor = isRejected ? '#FEF2F2' : (done || active ? '#F0FDF4' : '#F1F5F9');

                return (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: isRejected ? 0.5 : 1 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: bgColor, color: color, border: `1px solid ${color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700
                    }}>
                      {done ? '✓' : steps.indexOf(step) + 1}
                    </div>
                    <span style={{ color: isRejected ? '#94A3B8' : (done || active ? '#0F172A' : '#94A3B8'), fontSize: 12, textTransform: 'capitalize', fontWeight: done || active ? 600 : 400 }}>
                      {step}
                    </span>
                    {step !== 'fulfilled' && <div style={{ width: 12, height: 1, background: '#E2E8F0', marginLeft: 2 }} />}
                  </div>
                );
              })}
              {req.requestStatus === 'rejected' && (
                <div style={{ width: '100%', fontSize: 12, color: '#EF4444', fontWeight: 600, marginTop: 8 }}>
                  Status: Request Rejected
                </div>
              )}
            </div>

            {/* Footer / Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
              <div style={{ color: '#0F172A', fontWeight: 700, fontSize: 16 }}>
                ₹{req.netAmount || 0}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* Pay Button */}
                {req.paymentStatus === 'unpaid' && req.requestStatus !== 'rejected' && (
                  <button className="m-btn m-btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => handlePay(req)}>
                    Pay ₹{req.netAmount}
                  </button>
                )}

                {/* Download Button */}
                {canDownload && (
                  <a href={vaultAPI.getDownloadUrl(req.linkedVaultFileId)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <button className="m-btn m-btn-outline" style={{ padding: '6px 14px', fontSize: 12, borderColor: '#22C55E', color: '#16A34A' }}>
                      ⬇️ Download
                    </button>
                  </a>
                )}

                {/* Receipt Button */}
                {req.paymentStatus === 'paid' && (
                  <a href={vaultAPI.getReceiptUrl(req._id)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                    <button className="m-btn m-btn-ghost" style={{ padding: '6px 14px', fontSize: 12 }}>
                      📄 Receipt
                    </button>
                  </a>
                )}
              </div>
            </div>

            {/* Admin Note */}
            {req.adminNotes && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#FFFBEB', borderLeft: '3px solid #F59E0B', borderRadius: '0 8px 8px 0', fontSize: 12, color: '#92400E' }}>
                <strong>Note:</strong> {req.adminNotes}
              </div>
            )}
          </div>
        );
      })}
    </ParentLayout>
  );
};

export default ParentDocumentRequests;