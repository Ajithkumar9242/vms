import React, { useEffect, useState } from 'react';
import {
  Form, Input, Select, Button, Card, App, Typography, Row, Col,
  Divider, Upload, Avatar, Space,
} from 'antd';
import {
  UploadOutlined, BankOutlined, UserOutlined, PhoneOutlined,
  GlobalOutlined, SaveOutlined,
} from '@ant-design/icons';
import { setupAPI } from '@/services/api';

const { Title, Text } = Typography;
const { Option } = Select;

const SchoolSettings = () => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    setLoading(true);
    setupAPI.getSchoolSetting()
      .then((res) => {
        if (res?.data) {
          form.setFieldsValue(res.data);
          setLogoUrl(res.data.logoUrl);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [form]);

  const onFinish = async (values) => {
    setSaving(true);
    try {
      await setupAPI.saveSchoolSetting(values);
      message.success('School settings saved successfully');
    } catch (e) {
      message.error(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async ({ file }) => {
    setUploadingLogo(true);
    try {
      const res = await setupAPI.uploadLogo(file);
      setLogoUrl(res.data?.logoUrl);
      form.setFieldValue('logoUrl', res.data?.logoUrl);
      message.success('Logo uploaded successfully');
    } catch (e) {
      message.error(e.message || 'Logo upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <BankOutlined style={{ fontSize: 22, color: '#3B82F6' }} />
        <Title level={4} style={{ margin: 0 }}>School Settings</Title>
      </div>

      <Card loading={loading} bordered={false} style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)', borderRadius: 12 }}>
        <Form form={form} layout="vertical" onFinish={onFinish}>

          {/* ─── Logo ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
            <Avatar
              size={80}
              src={logoUrl}
              icon={<BankOutlined />}
              style={{ background: '#EFF6FF', color: '#3B82F6', border: '2px solid #DBEAFE' }}
            />
            <div>
              <Upload
                showUploadList={false}
                accept="image/*"
                customRequest={handleLogoUpload}
                disabled={uploadingLogo}
              >
                <Button icon={<UploadOutlined />} loading={uploadingLogo} size="small">
                  Upload Logo
                </Button>
              </Upload>
              <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 4 }}>
                PNG, JPG up to 5MB
              </Text>
            </div>
          </div>

          {/* ─── Basic Info ─────────────────────────────────────── */}
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13, fontWeight: 600 }}>
            Basic Information
          </Divider>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="School Name" name="schoolName" rules={[{ required: true, message: 'School name is required' }]}>
                <Input prefix={<BankOutlined style={{ color: '#94A3B8' }} />} placeholder="e.g. VMS International School" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Board Type" name="boardType">
                <Select placeholder="Select board">
                  {['CBSE', 'ICSE', 'STATE', 'IB', 'OTHER'].map((b) => (
                    <Option key={b} value={b}>{b}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Brief description of your school" />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item label="Registration No" name="registrationNo">
                <Input placeholder="School registration number" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Affiliation Number" name="affiliationNumber">
                <Input placeholder="Board affiliation no." />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Established Year" name="establishedYear">
                <Input type="number" placeholder="e.g. 1995" />
              </Form.Item>
            </Col>
          </Row>

          {/* ─── Principal ──────────────────────────────────────── */}
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13, fontWeight: 600 }}>
            <UserOutlined /> Principal
          </Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item label="Principal Name" name={['principal', 'name']}>
                <Input placeholder="Full name" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Principal Phone" name={['principal', 'phone']}>
                <Input prefix={<PhoneOutlined style={{ color: '#94A3B8' }} />} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Principal Email" name={['principal', 'email']}>
                <Input type="email" />
              </Form.Item>
            </Col>
          </Row>

          {/* ─── Contact ────────────────────────────────────────── */}
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13, fontWeight: 600 }}>
            <PhoneOutlined /> Contact
          </Divider>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item label="Phone" name={['contact', 'phone']}>
                <Input prefix={<PhoneOutlined style={{ color: '#94A3B8' }} />} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Email" name={['contact', 'email']}>
                <Input type="email" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Logo URL" name="logoUrl">
                <Input placeholder="Or paste URL directly" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Address" name={['contact', 'address']}>
            <Input.TextArea rows={2} />
          </Form.Item>

          {/* ─── Social Links ───────────────────────────────────── */}
          <Divider orientation="left" orientationMargin={0} style={{ fontSize: 13, fontWeight: 600 }}>
            <GlobalOutlined /> Social Links
          </Divider>
          <Form.List name="socialLinks">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Row key={key} gutter={12} align="middle">
                    <Col xs={10}>
                      <Form.Item {...rest} name={[name, 'platform']} noStyle>
                        <Select placeholder="Platform" style={{ width: '100%' }}>
                          {['website', 'facebook', 'instagram', 'youtube', 'twitter', 'linkedin'].map((p) => (
                            <Option key={p} value={p}>{p}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col xs={12}>
                      <Form.Item {...rest} name={[name, 'url']} noStyle>
                        <Input placeholder="https://..." />
                      </Form.Item>
                    </Col>
                    <Col xs={2}>
                      <Button type="link" danger onClick={() => remove(name)} style={{ padding: 0 }}>✕</Button>
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} style={{ marginTop: 8 }}>+ Add Social Link</Button>
              </>
            )}
          </Form.List>

          <Form.Item style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} size="large">
              Save Settings
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default SchoolSettings;
