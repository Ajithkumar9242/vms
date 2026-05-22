import React, { useEffect, useMemo, useState } from 'react';
import { Card, Form, Input, Switch, Button, Tabs, Typography, App, Row, Col, Tag, Alert } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import useAuthStore from '@/store/authStore';
import { setupAPI } from '@/services/api';

const { Text } = Typography;

const TEMPLATE_LABELS = {
  admissionApproval: 'Admission Approval',
  feeReminder: 'Fee Reminder',
  attendanceAlert: 'Attendance Alert',
  examPublished: 'Exam Published',
};

const sampleValues = {
  studentName: 'Arjun S. Shetty',
  parentName: 'Mr. Shetty',
  className: 'Class 1',
  schoolName: 'VSS International School',
  amount: 'Rs. 12,500',
  dueDate: '20 Jun 2026',
};

const renderTemplate = (template = '', values = sampleValues) =>
  String(template).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : ''
  ));

const MessageTemplates = () => {
  const { message } = App.useApp();
  const user = useAuthStore((s) => s.user);
  const isVisitor = user?.role === 'visitor';
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const templates = Form.useWatch([], form) || {};

  useEffect(() => {
    setLoading(true);
    setupAPI.getMessageTemplates()
      .then((res) => form.setFieldsValue(res?.data || {}))
      .catch((e) => message.error(e.message || 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, [form, message]);

  const items = useMemo(() => Object.entries(TEMPLATE_LABELS).map(([key, label]) => ({
    key,
    label,
    children: (
      <Row gutter={[16, 16]}>
        <Col xs={24} md={14}>
          <Form.Item name={[key, 'enabled']} valuePropName="checked" label="Enabled">
            <Switch />
          </Form.Item>
          <Form.Item name={[key, 'body']} label={`${label} Template`}>
            <Input.TextArea rows={8} />
          </Form.Item>
        </Col>
        <Col xs={24} md={10}>
          <Card size="small" title="Live Preview">
            <Text style={{ whiteSpace: 'pre-wrap' }}>
              {renderTemplate(templates?.[key]?.body || '')}
            </Text>
          </Card>
        </Col>
      </Row>
    ),
  })), [templates]);

  const save = async (values) => {
    setSaving(true);
    try {
      await setupAPI.saveMessageTemplates(values);
      message.success('Message templates saved');
    } catch (e) {
      message.error(e.message || 'Failed to save templates');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {isVisitor && (
        <Alert
          type="info"
          showIcon
          message="You are logged in as a visitor. Message templates are read-only."
          style={{ marginBottom: 16 }}
        />
      )}
      <Card loading={loading} title={<><MessageOutlined /> Message Templates</>}>
        <div style={{ marginBottom: 12 }}>
          {Object.keys(sampleValues).map((v) => <Tag key={v}>{`{{${v}}}`}</Tag>)}
        </div>
        <Form form={form} layout="vertical" onFinish={save} disabled={isVisitor}>
          <Tabs items={items} />
          {!isVisitor && (
            <Button type="primary" htmlType="submit" loading={saving}>Save Templates</Button>
          )}
        </Form>
      </Card>
    </div>
  );
};

export default MessageTemplates;
