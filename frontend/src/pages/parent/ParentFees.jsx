import React, { useEffect, useState, useCallback, useRef } from 'react';
import ParentLayout from '@/components/mobile/ParentLayout';
import { feesAPI, studentAPI, setupAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import { downloadFeeReceiptPDF } from '@/utils/pdf';
import dayjs from 'dayjs';


// ─── Load Razorpay SDK once ──────────────────────────────────
let _rzpLoaded = false;
const loadRazorpay = () =>
  new Promise((resolve) => {
    if (_rzpLoaded && window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload  = () => { _rzpLoaded = true; resolve(true); };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });

// ─── Fee status helpers ──────────────────────────────────────
const isFeeConfigured = (summary) =>
  summary && summary.totalFee > 0;

const feeStatusBadge = (summary) => {
  if (!isFeeConfigured(summary)) return 'm-badge-neutral';
  if (summary.status === 'Paid')    return 'm-badge-success';
  if (summary.status === 'Partial') return 'm-badge-warning';
  return 'm-badge-danger';
};

const feeStatusLabel = (summary) => {
  if (!isFeeConfigured(summary)) return 'Not Configured';
  return summary.status;
};

const ParentFees = () => {
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [feeData, setFeeData]       = useState(null);
  const [studentId, setStudentId]   = useState(null);
  const [student, setStudent]       = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({ amount: '', transactionId: '', proofUrl: '' });
  const [submitting, setSubmitting] = useState(false);
  const [rzpLoading, setRzpLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [msg, setMsg]               = useState(null);
  const [schoolName, setSchoolName] = useState('VMS School');

  useEffect(() => {
    resolveStudent();
    // Load school name for PDF
    setupAPI.getSchoolSetting().then((res) => {
      const name = res?.data?.schoolName || res?.data?.name;
      if (name) setSchoolName(name);
    }).catch(() => {});
  }, []);

  const resolveStudent = useCallback(async () => {
    setLoading(true);
    setError(null);
    const linked = user?.linkedEntity?.linkedStudents?.[0];
    const sid = linked?._id || user?.studentId || user?.metadata?.studentId;
    if (sid) {
      setStudentId(sid);
      if (linked) setStudent(linked);
      await loadFees(sid);
      return;
    }
    try {
      const res = await studentAPI.getAll({ limit: 1 });
      const s   = res?.data?.students?.[0] || res?.data?.[0];
      if (s) {
        setStudentId(s._id);
        setStudent(s);
        await loadFees(s._id);
      } else {
        setError('No student linked to your account. Contact admin.');
        setLoading(false);
      }
    } catch (e) {
      setError(e.message || 'Failed to load student data.');
      setLoading(false);
    }
  }, [user]);

  const loadFees = useCallback(async (sid) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await feesAPI.getStudentFees(sid);
      const data = res?.data || res;
      setFeeData(data);
      // Also grab student from fee data if not already set
      if (data?.student && !student) setStudent(data.student);
    } catch (e) {
      setError(e.message || 'Failed to load fee data.');
    } finally {
      setLoading(false);
    }
  }, []);


  // ─── PDF Receipt Download ────────────────────────────────
  const handleDownloadPDF = () => {
    setPdfLoading(true);
    try {
      downloadFeeReceiptPDF({
        student:    student || feeData?.student || { name: user?.name },
        classInfo:  student?.classId || feeData?.student?.classId || {},
        summary:    feeData?.summary,
        invoice:    feeData?.invoice,
        payments:   feeData?.payments || [],
        schoolName,
      });
    } catch (e) {
      setMsg({ type: 'error', text: 'PDF generation failed: ' + e.message });
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ─── Razorpay Online Payment ─────────────────────────────
  const handleRazorpay = async () => {
    const due = feeData?.summary?.totalDue;
    if (!due || due <= 0) {
      setMsg({ type: 'error', text: 'No outstanding dues.' }); return;
    }

    setRzpLoading(true);
    setMsg(null);
    try {
      const loaded = await loadRazorpay();
      if (!loaded || !window.Razorpay) {
        setMsg({ type: 'error', text: 'Could not load payment gateway. Check your internet.' });
        return;
      }

      // Use the fees pay endpoint directly (pass paymentMode=razorpay)
      // We create an ephemeral RZP session using school's key from settings
      const keyId = import.meta.env.VITE_RAZORPAY_KEY_ID || '';
      if (!keyId) {
        setMsg({ type: 'error', text: 'Payment gateway not configured. Please use UPI manual payment.' });
        return;
      }

      const options = {
        key: keyId,
        amount: Math.round(due * 100),       // paise
        currency: 'INR',
        name: 'VMS School ERP',
        description: `Fee payment — ${feeData?.resolvedStudent?.name || 'Student'}`,
        image: '/icons/icon-192.png',
        prefill: {
          name:  user?.name  || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: { color: '#1B3A5C' },
        modal: {
          ondismiss: () => {
            setMsg({ type: 'error', text: 'Payment cancelled.' });
          },
        },
        handler: async (response) => {
          // Record payment via fees API
          try {
            await feesAPI.pay({
              studentId,
              amount: due,
              paymentMode: 'razorpay',
              transactionId: response.razorpay_payment_id,
              invoiceId: feeData?.invoice?._id || undefined,
            });
            setMsg({ type: 'success', text: `✅ Payment of ₹${due.toLocaleString('en-IN')} recorded! Receipt will be sent.` });
            await loadFees(studentId);
          } catch (e) {
            setMsg({ type: 'error', text: `Payment captured but recording failed: ${e.message}. Contact admin with ID: ${response.razorpay_payment_id}` });
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        setMsg({ type: 'error', text: `Payment failed: ${resp.error?.description || 'Unknown error'}. Try again.` });
      });
      rzp.open();
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Payment initiation failed.' });
    } finally {
      setRzpLoading(false);
    }
  };

  // ─── UPI Manual Payment ──────────────────────────────────
  const validateManualForm = () => {
    if (!manualForm.amount || parseFloat(manualForm.amount) <= 0) {
      setMsg({ type: 'error', text: 'Enter a valid amount.' }); return false;
    }
    if (!manualForm.transactionId.trim()) {
      setMsg({ type: 'error', text: 'UPI Transaction ID is required.' }); return false;
    }
    const due = feeData?.summary?.totalDue || 0;
    if (parseFloat(manualForm.amount) > due) {
      setMsg({ type: 'error', text: `Amount cannot exceed due amount of ₹${due.toLocaleString('en-IN')}.` }); return false;
    }
    return true;
  };

  const handleManualSubmit = async () => {
    if (!validateManualForm()) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await feesAPI.manualPayment({
        studentId,
        amount: parseFloat(manualForm.amount),
        paymentMode: 'upi',
        transactionId: manualForm.transactionId.trim(),
        proofUrl: manualForm.proofUrl.trim() || undefined,
        invoiceId: feeData?.invoice?._id || undefined,
      });
      setMsg({ type: 'success', text: '✅ Payment submitted! Awaiting admin approval (usually 1–2 hours).' });
      setShowManual(false);
      setManualForm({ amount: '', transactionId: '', proofUrl: '' });
      await loadFees(studentId);
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Submission failed. Try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const { summary, invoice, payments = [], student: feeStudent } = feeData || {};
  // Prefer state student (more complete), fall back to feeData.student
  const resolvedStudent = student || feeStudent;
  const configured = isFeeConfigured(summary);
  const progressPct = configured && summary.totalFee > 0
    ? Math.min(100, Math.round((summary.totalPaid / summary.totalFee) * 100))
    : 0;

  return (
    <ParentLayout title="Fee Details" subtitle="Payments & Invoices">

      {/* Alert */}
      {msg && (
        <div className={`m-alert m-alert-${msg.type === 'success' ? 'success' : 'error'}`}>
          {msg.text}
          <button onClick={() => setMsg(null)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
            ✕
          </button>
        </div>
      )}

      {loading && <div className="m-spinner" />}

      {!loading && error && (
        <div className="m-card" style={{ borderLeft: '3px solid #EF4444' }}>
          <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>⚠️</div>
          <div style={{ fontSize: 14, color: '#DC2626', textAlign: 'center', marginBottom: 12 }}>{error}</div>
          <button className="m-btn m-btn-outline" onClick={resolveStudent}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Fee Not Configured banner */}
          {!configured && (
            <div className="m-card" style={{ background: '#FFF7ED', borderLeft: '3px solid #F59E0B', textAlign: 'center', padding: '20px 16px' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>
                Fee Structure Not Configured
              </div>
              <div style={{ fontSize: 12, color: '#B45309' }}>
                {!summary
                  ? 'No fee record found for your account.'
                  : 'The fee amount is set to ₹0. Contact admin to configure fee structure.'}
              </div>
            </div>
          )}

          {/* Fee Summary Card */}
          {summary && (
            <div className="m-card">
              <div className="m-card-header">
                <div>
                  <div className="m-card-title">
                    {resolvedStudent?.name ? `${student.name}'s Fees` : 'Annual Fees'}
                  </div>
                  <div className="m-card-sub">
                    {invoice?.invoiceNumber ? `Invoice: ${invoice.invoiceNumber}` : 'Current Year'}
                  </div>
                </div>
                <span className={`m-badge ${feeStatusBadge(summary)}`}>
                  {feeStatusLabel(summary)}
                </span>
              </div>

              {configured ? (
                <>
                  {/* Amount Boxes */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>₹{summary.totalFee.toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Total</div>
                    </div>
                    <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#16A34A' }}>₹{summary.totalPaid.toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 10, color: '#16A34A', marginTop: 2 }}>Paid</div>
                    </div>
                    <div style={{ background: summary.totalDue > 0 ? '#FEF2F2' : '#F0FDF4', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: summary.totalDue > 0 ? '#DC2626' : '#16A34A' }}>
                        ₹{summary.totalDue.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: 10, color: summary.totalDue > 0 ? '#DC2626' : '#16A34A', marginTop: 2 }}>Due</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="m-progress-bar">
                    <div className="m-progress-fill" style={{
                      width: `${progressPct}%`,
                      background: progressPct === 100
                        ? 'linear-gradient(90deg, #22C55E, #16A34A)'
                        : progressPct > 50
                          ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                          : 'linear-gradient(90deg, #EF4444, #DC2626)',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B', marginTop: 4 }}>
                    <span>{progressPct}% paid</span>
                    {invoice?.dueDate && (
                      <span>Due: <strong style={{ color: dayjs(invoice.dueDate).isBefore(dayjs()) && summary.totalDue > 0 ? '#DC2626' : '#0F172A' }}>
                        {dayjs(invoice.dueDate).format('DD MMM YYYY')}
                      </strong></span>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '12px 0', color: '#94A3B8', fontSize: 13 }}>
                  Fee amount not set — contact admin.
                </div>
              )}
            </div>
          )}

          {/* Fee Component Breakdown (from student-wise profile) */}
          {feeData?.feeProfile?.selectedComponents?.length > 0 && configured && (
            <div className="m-card">
              <div className="m-card-title" style={{ marginBottom: 10 }}>Fee Breakdown</div>
              {feeData.feeProfile.selectedComponents.map((comp, i) => (
                <div key={i} className="m-list-item">
                  <div className="m-list-icon" style={{ background: comp.mandatory ? '#FEF2F2' : '#EFF6FF', fontSize: 16 }}>
                    {comp.mandatory ? '📌' : '✅'}
                  </div>
                  <div className="m-list-body">
                    <div className="m-list-title">{comp.name}</div>
                    <div className="m-list-desc">{comp.code} · {comp.recurringType || 'yearly'}</div>
                  </div>
                  <div className="m-list-right">
                    <div style={{ fontWeight: 700, fontSize: 14 }}>₹{(comp.amount || 0).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              ))}
              {/* Discounts */}
              {feeData.feeProfile.discounts?.length > 0 && (
                <>
                  <div style={{ height: 1, background: '#E2E8F0', margin: '8px 0' }} />
                  {feeData.feeProfile.discounts.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                      <span style={{ fontSize: 13, color: '#16A34A' }}>🏷 {d.label || d.type} Discount</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#16A34A' }}>
                        -{d.discountType === 'percent' ? `${d.value}%` : `₹${d.value.toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  ))}
                </>
              )}
              {/* Net total */}
              <div style={{ borderTop: '1px solid #E2E8F0', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>Net Total</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#1B3A5C' }}>
                  ₹{(feeData.feeProfile.totalFee || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          {/* Penalty Notice */}
          {(feeData?.invoice?.penaltyAmount > 0) && (
            <div className="m-card" style={{ borderLeft: '3px solid #EF4444', background: '#FEF2F2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#DC2626' }}>⚠️ Late Fee Applied</div>
                  <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>Contact school to enquire about waiver</div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#DC2626' }}>
                  +₹{(feeData.invoice.penaltyAmount || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          )}

          {/* Installments */}

          {invoice?.feeItems?.length > 0 && configured && (
            <div className="m-card">
              <div className="m-card-title" style={{ marginBottom: 10 }}>Installments</div>
              {invoice.feeItems.map((item, i) => {
                const overdue = item.dueDate && dayjs(item.dueDate).isBefore(dayjs());
                return (
                  <div key={i} className="m-list-item">
                    <div className="m-list-icon" style={{ background: overdue ? '#FEE2E2' : '#EFF6FF', fontSize: 16 }}>
                      {overdue ? '⚠️' : '📅'}
                    </div>
                    <div className="m-list-body">
                      <div className="m-list-title">{item.name}</div>
                      <div className="m-list-desc" style={{ color: overdue ? '#DC2626' : undefined }}>
                        {item.dueDate ? dayjs(item.dueDate).format('DD MMM YYYY') : 'No due date'}
                        {overdue ? ' • Overdue' : ''}
                      </div>
                    </div>
                    <div className="m-list-right">
                      <div style={{ fontWeight: 700, fontSize: 14 }}>₹{item.amount?.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Payment Buttons — only when there's a valid due amount */}
          {configured && summary?.totalDue > 0 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              {import.meta.env.VITE_RAZORPAY_KEY_ID ? (
                <button
                  className="m-btn m-btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleRazorpay}
                  disabled={rzpLoading}
                >
                  {rzpLoading ? '⏳ Loading...' : '💳 Pay Online'}
                </button>
              ) : (
                <div style={{
                  flex: 1, padding: '10px 12px', borderRadius: 10,
                  background: '#F1F5F9', border: '1px solid #E2E8F0',
                  fontSize: 12, color: '#94A3B8', textAlign: 'center', lineHeight: 1.4,
                }}>
                  🔒 Online payment not available.<br />Use UPI manual below.
                </div>
              )}
              <button
                className="m-btn m-btn-outline"
                style={{ flex: 1 }}
                onClick={() => { setShowManual(!showManual); setMsg(null); }}
              >
                📱 UPI Manual
              </button>
            </div>
          )}

          {configured && summary?.totalDue === 0 && summary?.status === 'Paid' && (
            <div className="m-alert m-alert-success" style={{ textAlign: 'center' }}>
              🎉 All fees are paid! No dues remaining.
            </div>
          )}

          {/* Manual Payment Form */}
          {showManual && configured && (
            <div className="m-card" style={{ borderLeft: '3px solid #2563EB' }}>
              <div className="m-card-title" style={{ marginBottom: 12 }}>Submit UPI / Manual Payment</div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12, padding: '8px 10px', background: '#F0F9FF', borderRadius: 8 }}>
                📌 Transfer ₹{summary?.totalDue?.toLocaleString('en-IN')} to school UPI, then enter transaction details below.
              </div>
              <div className="m-form-group">
                <label className="m-label">Amount (₹) *</label>
                <input
                  className="m-input" type="number" min="1" max={summary?.totalDue}
                  placeholder={`Max: ₹${summary?.totalDue?.toLocaleString('en-IN')}`}
                  value={manualForm.amount}
                  onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                />
              </div>
              <div className="m-form-group">
                <label className="m-label">UPI / Transaction ID *</label>
                <input
                  className="m-input" placeholder="e.g. UPI123456789"
                  value={manualForm.transactionId}
                  onChange={(e) => setManualForm({ ...manualForm, transactionId: e.target.value })}
                />
              </div>
              <div className="m-form-group">
                <label className="m-label">Screenshot URL <span style={{ color: '#94A3B8', fontWeight: 400 }}>(optional)</span></label>
                <input
                  className="m-input" placeholder="https://..."
                  value={manualForm.proofUrl}
                  onChange={(e) => setManualForm({ ...manualForm, proofUrl: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="m-btn m-btn-primary" style={{ flex: 2 }} onClick={handleManualSubmit} disabled={submitting}>
                  {submitting ? 'Submitting...' : '✓ Submit for Approval'}
                </button>
                <button className="m-btn m-btn-ghost" style={{ flex: 1 }} onClick={() => setShowManual(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Payment History */}
          {payments.length > 0 && (
            <div className="m-card">
              <div className="m-card-title" style={{ marginBottom: 10 }}>Payment History</div>
              {payments.map((p, i) => (
                <div key={p._id || i} className="m-list-item">
                  <div className="m-list-icon" style={{
                    background: p.status === 'approved' ? '#F0FDF4' : p.status === 'pending' ? '#FFF7ED' : p.status === 'rejected' ? '#FEF2F2' : '#F8FAFC',
                    fontSize: 16,
                  }}>
                    {p.status === 'approved' ? '✅' : p.status === 'pending' ? '⏳' : p.status === 'rejected' ? '❌' : '💳'}
                  </div>
                  <div className="m-list-body">
                    <div className="m-list-title">{p.paymentMode?.toUpperCase() || 'Payment'}</div>
                    <div className="m-list-desc">
                      {dayjs(p.paidAt).format('DD MMM YYYY')}
                      {p.receiptNumber ? ` · ${p.receiptNumber}` : ''}
                      {p.transactionId ? ` · ${p.transactionId.slice(0, 16)}...` : ''}
                    </div>
                    {p.status === 'rejected' && p.remarks && (
                      <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>Reason: {p.remarks}</div>
                    )}
                  </div>
                  <div className="m-list-right">
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>
                      ₹{p.amount?.toLocaleString('en-IN')}
                    </div>
                    <span className={`m-badge ${p.status === 'approved' ? 'm-badge-success' : p.status === 'pending' ? 'm-badge-warning' : p.status === 'rejected' ? 'm-badge-danger' : 'm-badge-neutral'}`} style={{ marginTop: 3 }}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── Fee Receipt Card ─── */}
          {configured && payments.length > 0 && (
            <div className="m-card" style={{
              background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
              border: '1.5px solid #DBEAFE',
            }}>
              <div className="m-card-header" style={{ marginBottom: 16 }}>
                <div>
                  <div className="m-card-title" style={{ color: '#1B3A5C' }}>📄 Fee Receipt</div>
                  <div className="m-card-sub">
                    {invoice?.invoiceNumber ? `Invoice #${invoice.invoiceNumber}` : 'Current year'}
                  </div>
                </div>
                <span className={`m-badge ${feeStatusBadge(summary)}`}>
                  {feeStatusLabel(summary)}
                </span>
              </div>

              {/* Receipt Preview */}
              <div style={{ background: '#fff', borderRadius: 10, padding: '14px', marginBottom: 14, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>Student</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{resolvedStudent?.name || user?.name || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>Class</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{student?.classId?.name || '—'}</span>
                </div>
                <div style={{ borderTop: '1px dashed #E2E8F0', margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>Total Fees</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>₹{summary?.totalFee?.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#16A34A' }}>Paid</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#16A34A' }}>₹{summary?.totalPaid?.toLocaleString('en-IN')}</span>
                </div>
                {summary?.totalDue > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#DC2626' }}>Balance Due</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>₹{summary?.totalDue?.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div style={{ borderTop: '1px dashed #E2E8F0', margin: '10px 0' }} />
                <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
                  Generated: {dayjs().format('DD MMM YYYY, hh:mm A')} · {schoolName}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="m-btn m-btn-primary"
                  style={{ flex: 2 }}
                  onClick={handleDownloadPDF}
                  disabled={pdfLoading}
                >
                  {pdfLoading ? '⏳ Generating...' : '📥 Download PDF'}
                </button>
                <button
                  className="m-btn m-btn-outline"
                  style={{ flex: 1 }}
                  onClick={handlePrint}
                >
                  🖨️ Print
                </button>
              </div>
            </div>
          )}

          {/* No fee data at all */}
          {!summary && !error && (
            <div className="m-empty">
              <div className="m-empty-icon">📄</div>
              <div className="m-empty-text">No fee record found for your account.</div>
              <button className="m-btn m-btn-ghost" style={{ marginTop: 12, width: 'auto', padding: '8px 20px' }}
                onClick={resolveStudent}>
                Refresh
              </button>
            </div>
          )}

        </>
      )}
    </ParentLayout>
  );
};

export default ParentFees;
