import React, { useState } from 'react';
import {
  Card, Typography, Input, Button, Descriptions, Tag, Result,
  Space, Tabs, Empty, Spin, Divider, App, Row, Col, Timeline,
} from 'antd';
import {
  SearchOutlined, FileTextOutlined, PhoneOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  HomeFilled, CreditCardOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { onlineAdmissionAPI } from '@/services/api';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

const STATUS_CONFIG = {
  pending: { color: 'orange', icon: <ClockCircleOutlined />, label: 'Pending Review' },
  approved: { color: 'green', icon: <CheckCircleOutlined />, label: 'Approved' },
  rejected: { color: 'red', icon: <CloseCircleOutlined />, label: 'Rejected' },
};

const PAYMENT_CONFIG = {
  paid: { color: 'green', label: 'Paid ✓' },
  pending: { color: 'orange', label: 'Pending' },
  failed: { color: 'red', label: 'Failed' },
  na: { color: 'default', label: 'N/A' },
};

const ApplicationStatus = () => {
  const { message } = App.useApp();
  const [searchMode, setSearchMode] = useState('applicationNo');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchValue.trim()) {
      message.warning('Please enter a search value');
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      let res;
      if (searchMode === 'applicationNo') {
        res = await onlineAdmissionAPI.checkStatus(searchValue.trim());
        setResults(res.data?.admission ? [res.data.admission] : []);
      } else {
        res = await onlineAdmissionAPI.searchByPhone(searchValue.trim());
        setResults(res.data?.admissions || []);
      }
    } catch (err) {
      setResults([]);
      if (err.message && !err.message.includes('Network')) {
        message.info(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const renderAdmissionCard = (admission) => {
    const statusCfg = STATUS_CONFIG[admission.status] || STATUS_CONFIG.pending;
    const paymentCfg = PAYMENT_CONFIG[admission.paymentStatus] || PAYMENT_CONFIG.na;

    return (
      <Card
        key={admission._id || admission.applicationNo}
        className="status-result-card"
        style={{ marginBottom: 16 }}
      >
        {/* Status Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Application Number</Text>
            <Title level={4} style={{ margin: '4px 0', color: '#1B3A5C' }}>{admission.applicationNo}</Title>
          </div>
          <Tag
            color={statusCfg.color}
            icon={statusCfg.icon}
            style={{ fontSize: 14, padding: '4px 12px', borderRadius: 20 }}
          >
            {statusCfg.label}
          </Tag>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <Descriptions column={{ xs: 1, sm: 2 }} size="small" labelStyle={{ fontWeight: 500, color: '#64748B' }}>
          <Descriptions.Item label="Student Name">
            <Text strong>{admission.studentName}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Class">
            {admission.classId?.name || '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Mode">
            <Tag color={admission.mode === 'online' ? 'blue' : 'default'} style={{ textTransform: 'capitalize' }}>
              {admission.mode || 'offline'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Type">
            <span style={{ textTransform: 'capitalize' }}>{admission.type || '—'}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Payment Status">
            <Tag color={paymentCfg.color}>{paymentCfg.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Applied On">
            {admission.createdAt ? dayjs(admission.createdAt).format('DD MMM YYYY, hh:mm A') : '—'}
          </Descriptions.Item>
          {admission.approvedAt && (
            <Descriptions.Item label="Processed On">
              {dayjs(admission.approvedAt).format('DD MMM YYYY, hh:mm A')}
            </Descriptions.Item>
          )}
          {admission.remarks && (
            <Descriptions.Item label="Remarks" span={2}>
              <Text type={admission.status === 'rejected' ? 'danger' : undefined}>
                {admission.remarks}
              </Text>
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* Timeline */}
        <Divider orientation="left" style={{ fontSize: 13, marginTop: 20 }}>Application Timeline</Divider>
        <Timeline
          items={[
            {
              color: 'blue',
              children: (
                <div>
                  <Text strong style={{ fontSize: 13 }}>Application Submitted</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {admission.createdAt ? dayjs(admission.createdAt).format('DD MMM YYYY, hh:mm A') : '—'}
                  </Text>
                </div>
              ),
            },
            ...(admission.paymentStatus === 'paid' ? [{
              color: 'green',
              children: (
                <div>
                  <Text strong style={{ fontSize: 13 }}>Payment Received</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    <CreditCardOutlined /> Application fee paid
                  </Text>
                </div>
              ),
            }] : []),
            ...(admission.status === 'approved' ? [{
              color: 'green',
              children: (
                <div>
                  <Text strong style={{ fontSize: 13 }}>Admission Approved ✓</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {admission.approvedAt ? dayjs(admission.approvedAt).format('DD MMM YYYY, hh:mm A') : ''}
                  </Text>
                </div>
              ),
            }] : []),
            ...(admission.status === 'rejected' ? [{
              color: 'red',
              children: (
                <div>
                  <Text strong style={{ fontSize: 13 }}>Admission Rejected</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {admission.remarks || 'No reason provided'}
                  </Text>
                </div>
              ),
            }] : []),
            ...(admission.status === 'pending' ? [{
              color: 'gray',
              children: (
                <div>
                  <Text style={{ fontSize: 13, color: '#94A3B8' }}>Under Review</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Your application is being reviewed by the school
                  </Text>
                </div>
              ),
            }] : []),
          ]}
        />
      </Card>
    );
  };

  return (
    <div className="admission-page">
      {/* Header */}
      <div className="admission-header">
        <div className="admission-header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <HomeFilled style={{ fontSize: 28, color: '#FFF' }} />
            <div>
              <Title level={3} style={{ color: '#FFF', margin: 0 }}>VMS School</Title>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Application Status Tracker</Text>
            </div>
          </div>
          <Button
            type="text"
            style={{ color: '#FFF' }}
            onClick={() => window.location.href = '/online-admission'}
          >
            ← Apply Now
          </Button>
        </div>
      </div>

      <div className="admission-container" style={{ maxWidth: 720 }}>
        {/* Search Card */}
        <Card className="admission-card" style={{ marginBottom: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <SearchOutlined style={{ fontSize: 36, color: '#1B3A5C', marginBottom: 8 }} />
            <Title level={4} style={{ margin: '8px 0 4px', color: '#1B3A5C' }}>Track Your Application</Title>
            <Paragraph type="secondary">
              Search by your application number or registered phone number
            </Paragraph>
          </div>

          <Tabs
            centered
            activeKey={searchMode}
            onChange={(key) => {
              setSearchMode(key);
              setSearchValue('');
              setResults(null);
              setSearched(false);
            }}
            items={[
              {
                key: 'applicationNo',
                label: (
                  <span><FileTextOutlined /> Application No</span>
                ),
              },
              {
                key: 'phone',
                label: (
                  <span><PhoneOutlined /> Phone Number</span>
                ),
              },
            ]}
          />

          <Row gutter={12} style={{ marginTop: 16 }}>
            <Col flex="1">
              <Input
                placeholder={searchMode === 'applicationNo' ? 'e.g., APP-2026-00001' : 'e.g., 9876543210'}
                size="large"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={handleKeyPress}
                prefix={searchMode === 'applicationNo' ? <FileTextOutlined style={{ color: '#94A3B8' }} /> : <PhoneOutlined style={{ color: '#94A3B8' }} />}
                id="status-search-input"
                maxLength={searchMode === 'phone' ? 10 : 20}
              />
            </Col>
            <Col>
              <Button
                type="primary"
                size="large"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                loading={loading}
                style={{ height: 40 }}
                id="status-search-btn"
              >
                Search
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Results */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin size="large" />
          </div>
        )}

        {!loading && searched && results !== null && (
          <div>
            {results.length > 0 ? (
              results.map(renderAdmissionCard)
            ) : (
              <Card className="admission-card">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <div>
                      <Text>No applications found</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {searchMode === 'applicationNo'
                          ? 'Please check the application number and try again.'
                          : 'No applications found for this phone number.'}
                      </Text>
                    </div>
                  }
                />
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="admission-footer">
        <Text type="secondary" style={{ fontSize: 12 }}>
          © {new Date().getFullYear()} VMS School — All rights reserved. For queries, contact the school office.
        </Text>
      </div>
    </div>
  );
};

export default ApplicationStatus;
