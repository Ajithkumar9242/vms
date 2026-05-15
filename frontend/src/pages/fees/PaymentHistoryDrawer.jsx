import React, { useEffect, useState } from 'react';
import { Drawer, Timeline, Tag, Spin, Empty, Typography, Divider, App } from 'antd';
import {
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleFilled,
  WalletOutlined,
} from '@ant-design/icons';
import { feesAPI } from '@/services/api';

const { Text, Title } = Typography;

const MODE_LABELS = {
  cash: { label: 'Cash', color: 'green' },
  upi: { label: 'UPI', color: 'blue' },
  razorpay: { label: 'Razorpay', color: 'purple' },
};

/**
 * PaymentHistoryDrawer — shows all payments + fee summary for a student.
 * Props:
 *   open       – whether drawer is visible
 *   studentId  – Mongo _id of the student
 *   studentName – display name
 *   onClose    – callback when closed
 */
const PaymentHistoryDrawer = ({ open, studentId, studentName, onClose }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!open || !studentId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await feesAPI.getStudentFees(studentId);
        setData(res.data);
      } catch (err) {
        message.error(err.message || 'Failed to load payment history');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [open, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = data?.summary;
  const payments = data?.payments || [];

  return (
    <Drawer
      title={`Payment History — ${studentName || ''}`}
      open={open}
      onClose={onClose}
      width={440}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : !data ? (
        <Empty description="No data available" />
      ) : (
        <>
          {/* ─── Summary Cards ─────────────────────────────── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <SummaryCard
              label="Total Fee"
              value={summary?.totalFee}
              color="var(--color-secondary)"
              icon={<WalletOutlined />}
            />
            <SummaryCard
              label="Paid"
              value={summary?.totalPaid}
              color="#22C55E"
              icon={<CheckCircleFilled />}
            />
            <SummaryCard
              label="Due"
              value={summary?.totalDue}
              color={summary?.totalDue > 0 ? '#EF4444' : '#22C55E'}
              icon={<DollarOutlined />}
            />
          </div>

          <Divider style={{ margin: '0 0 20px 0' }}>
            <Text type="secondary" style={{ fontSize: 12, letterSpacing: 1 }}>
              TRANSACTIONS
            </Text>
          </Divider>

          {/* ─── Timeline ─────────────────────────────────── */}
          {payments.length === 0 ? (
            <Empty description="No payments recorded yet" />
          ) : (
            <Timeline
              items={payments.map((p) => {
                const mode = MODE_LABELS[p.paymentMode] || { label: p.paymentMode, color: 'default' };
                return {
                  dot: <ClockCircleOutlined style={{ color: 'var(--color-secondary)' }} />,
                  children: (
                    <div
                      style={{
                        background: '#F8FAFC',
                        borderRadius: 8,
                        padding: '12px 16px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 4,
                        }}
                      >
                        <Text strong style={{ fontSize: 16 }}>
                          ₹{p.amount.toLocaleString('en-IN')}
                        </Text>
                        <Tag color={mode.color}>{mode.label}</Tag>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        {new Date(p.paidAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(p.paidAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      {p.transactionId && (
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                          TXN: {p.transactionId}
                        </div>
                      )}
                    </div>
                  ),
                };
              })}
            />
          )}
        </>
      )}
    </Drawer>
  );
};

/**
 * Small summary card used inside the drawer header.
 */
const SummaryCard = ({ label, value, color, icon }) => (
  <div
    style={{
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: 10,
      padding: '14px 12px',
      textAlign: 'center',
    }}
  >
    <div style={{ color, fontSize: 18, marginBottom: 4 }}>{icon}</div>
    <div style={{ fontSize: 16, fontWeight: 700, color }}>{`₹${(value ?? 0).toLocaleString('en-IN')}`}</div>
    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{label}</div>
  </div>
);

export default PaymentHistoryDrawer;
