import React, { useEffect, useState } from 'react';
import { Card, Form, Input, Switch, Button, Alert, message, Typography } from 'antd';
import { EyeInvisibleOutlined, EyeTwoTone, LockOutlined } from '@ant-design/icons';
import { setupAPI } from '@/services/api';

const { Title, Text } = Typography;

const PaymentSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setupAPI.getPaymentSettings()
      .then((res) => { if (res?.data) form.setFieldsValue(res.data); })
      .finally(() => setLoading(false));
  }, [form]);

  const onFinish = async (values) => {
    // Strip empty razorpaySecret if not changed (don't overwrite with empty)
    if (!values.razorpaySecret) delete values.razorpaySecret;
    setSaving(true);
    try {
      await setupAPI.savePaymentSettings(values);
      message.success('Payment settings saved');
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={4} style={{ marginBottom: 8 }}>💳 Payment Settings</Title>
      <Alert
        type="info"
        message="Razorpay keys are encrypted in transit. The secret is write-only and never returned."
        style={{ marginBottom: 20, maxWidth: 640 }}
      />
      <Card style={{ maxWidth: 640 }} loading={loading}>
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item label="Razorpay Key ID" name="razorpayKey">
            <Input prefix={<LockOutlined />} placeholder="rzp_live_..." />
          </Form.Item>
          <Form.Item label="Razorpay Key Secret" name="razorpaySecret" extra="Leave blank to keep existing secret">
            <Input.Password
              placeholder="Leave blank to keep existing"
              iconRender={(visible) => (visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>
          <Form.Item label="QR Code URL (for manual UPI)" name="qrCodeUrl">
            <Input placeholder="https://your-qr-image-url.png" />
          </Form.Item>
          <Form.Item label="Allow Manual Payment" name="allowManualPayment" valuePropName="checked">
            <Switch checkedChildren="Yes" unCheckedChildren="No" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>Save Settings</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default PaymentSettings;
