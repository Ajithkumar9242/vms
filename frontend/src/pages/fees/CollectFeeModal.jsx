import React, { useState } from 'react';
import { Modal, Form, InputNumber, Select, Input, App } from 'antd';
import { feesAPI } from '@/services/api';

const { Option } = Select;

/**
 * CollectFeeModal — modal to record a payment for a student.
 * Props:
 *   open       – whether modal is visible
 *   student    – { _id, name, totalDue } of the selected student
 *   onClose    – callback when closed
 *   onSuccess  – callback after successful payment
 */
const CollectFeeModal = ({ open, student, onClose, onSuccess }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Guard: invoiceId is required — without it we cannot post a payment
      if (!student?.invoiceId) {
        message.error(
          'No invoice found for this student. Generate an invoice first from Assign Fees or click "+ Invoice" in the overview.'
        );
        return;
      }

      setSubmitting(true);

      await feesAPI.payInstallment(student.invoiceId, {
        amount:        values.amount,
        paymentMode:   values.paymentMode,
        transactionId: values.transactionId || undefined,
        // installmentId not sent here — backend auto-distributes to earliest unpaid
      });

      message.success(
        `₹${values.amount.toLocaleString('en-IN')} payment recorded for ${student.name}`
      );
      form.resetFields();
      onSuccess?.();
    } catch (err) {
      if (err.errorFields) return; // AntD form validation — already shown inline
      // Surface API errors (404 / 500 / network) clearly to the user
      message.error(err.message || 'Payment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose?.();
  };

  return (
    <Modal
      title={`Collect Fee — ${student?.name || ''}`}
      open={open}
      onCancel={handleClose}
      onOk={handleSubmit}
      okText="Record Payment"
      okButtonProps={{ loading: submitting, disabled: submitting, id: 'fee-submit-btn' }}
      cancelButtonProps={{ disabled: submitting }}
      destroyOnClose
      maskClosable={false}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        style={{ marginTop: 16 }}
      >
        {student && (
          <div
            style={{
              background: '#F0F5FF',
              border: '1px solid #D6E4FF',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: '#64748B' }}>Outstanding Due</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                ₹{(student.totalDue ?? 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#64748B' }}>Student</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{student.name}</div>
            </div>
          </div>
        )}

        <Form.Item
          name="amount"
          label="Amount (₹)"
          rules={[
            { required: true, message: 'Enter payment amount' },
            { type: 'number', min: 1, message: 'Amount must be at least ₹1' },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            placeholder="e.g. 5000"
            min={1}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value.replace(/,/g, '')}
            id="fee-amount-input"
          />
        </Form.Item>

        <Form.Item
          name="paymentMode"
          label="Payment Mode"
          rules={[{ required: true, message: 'Select payment mode' }]}
        >
          <Select placeholder="Select mode" id="fee-payment-mode">
            <Option value="cash">Cash</Option>
            <Option value="upi">UPI</Option>
            <Option value="razorpay">Razorpay</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="transactionId"
          label="Transaction ID"
          tooltip="Optional — for UPI / digital payments"
        >
          <Input placeholder="e.g. TXN123456789" id="fee-txn-input" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CollectFeeModal;
