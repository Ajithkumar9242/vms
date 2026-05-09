import React, { useEffect, useState, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Typography, Select, Table, Tag,
  Progress, Empty, Spin, Divider, Badge,
} from 'antd';
import {
  DollarCircleOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
  WarningOutlined, BarChartOutlined, TeamOutlined,
} from '@ant-design/icons';
import { feesAPI, schoolAPI } from '@/services/api';

const { Title, Text } = Typography;

// Simple SVG Bar Chart (no external dep)
const MiniBarChart = ({ data, height = 160 }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.collected), 1);
  const barW = Math.floor(100 / data.length) - 1;

  return (
    <div style={{ padding: '8px 0' }}>
      <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const pct    = (d.collected / max) * (height - 24);
          const x      = i * (100 / data.length) + 0.5;
          const barH   = Math.max(pct, 1);
          const y      = height - 20 - barH;
          const color  = d.collected > 0 ? '#2563EB' : '#E2E8F0';
          return (
            <g key={d.month}>
              <rect x={`${x}%`} y={y} width={`${barW}%`} height={barH}
                fill={color} rx="1" style={{ transition: 'height 0.4s' }} />
              <text x={`${x + barW / 2}%`} y={height - 6} textAnchor="middle"
                fontSize="4" fill="#94A3B8">{d.month}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
        Monthly Collection (Current Year)
      </div>
    </div>
  );
};

const FeeDashboard = () => {
  const [stats, setStats]        = useState(null);
  const [monthly, setMonthly]    = useState([]);
  const [classwise, setClasswise]= useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading]    = useState(false);
  const [classId, setClassId]    = useState(null);
  const [classes, setClasses]    = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (classId) params.classId = classId;

      const [statsRes, monthlyRes, classwiseRes, compRes] = await Promise.all([
        feesAPI.getDashboardStats(params),
        feesAPI.getMonthlyCollection(),
        feesAPI.getClasswiseDues(params),
        feesAPI.getComponentSummary(params),
      ]);
      setStats(statsRes.data || null);
      setMonthly(monthlyRes.data || []);
      setClasswise(classwiseRes.data || []);
      setComponents(compRes.data || []);
    } catch (e) {
      // Silent — dashboard can fail gracefully
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    schoolAPI.getClasses({ limit: 50 }).then(res => setClasses(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const collectionPct = stats
    ? stats.totalExpected > 0 ? Math.round((stats.totalCollected / stats.totalExpected) * 100) : 0
    : 0;

  const kpiCards = [
    {
      title: 'Total Collection',
      value: stats?.totalCollected || 0,
      prefix: '₹',
      color: '#22C55E',
      icon: <CheckCircleOutlined />,
      format: v => `₹${(v || 0).toLocaleString('en-IN')}`,
    },
    {
      title: 'Pending Dues',
      value: stats?.totalDue || 0,
      color: '#EF4444',
      icon: <ExclamationCircleOutlined />,
      format: v => `₹${(v || 0).toLocaleString('en-IN')}`,
    },
    {
      title: 'Overdue Invoices',
      value: stats?.overdueCount || 0,
      color: '#F59E0B',
      icon: <WarningOutlined />,
    },
    {
      title: 'Penalties Collected',
      value: stats?.totalPenalty || 0,
      color: '#8B5CF6',
      icon: <WarningOutlined />,
      format: v => `₹${(v || 0).toLocaleString('en-IN')}`,
    },
    {
      title: 'Discounts Granted',
      value: stats?.totalDiscount || 0,
      color: '#0EA5E9',
      icon: <DollarCircleOutlined />,
      format: v => `₹${(v || 0).toLocaleString('en-IN')}`,
    },
    {
      title: 'Total Invoices',
      value: stats?.totalInvoices || 0,
      color: '#1B3A5C',
      icon: <TeamOutlined />,
    },
  ];

  const classwiseCols = [
    { title: 'Class', dataIndex: 'className', key: 'className' },
    { title: 'Students', dataIndex: 'count', key: 'count', align: 'right' },
    {
      title: 'Expected', dataIndex: 'expected', key: 'expected', align: 'right',
      render: v => `₹${(v || 0).toLocaleString('en-IN')}`,
    },
    {
      title: 'Collected', dataIndex: 'collected', key: 'collected', align: 'right',
      render: v => <Text style={{ color: '#22C55E', fontWeight: 600 }}>₹{(v || 0).toLocaleString('en-IN')}</Text>,
    },
    {
      title: 'Due', dataIndex: 'due', key: 'due', align: 'right',
      render: v => <Text style={{ color: v > 0 ? '#EF4444' : '#22C55E', fontWeight: 600 }}>₹{(v || 0).toLocaleString('en-IN')}</Text>,
    },
    {
      title: 'Collection %', key: 'pct', align: 'right',
      render: (_, r) => {
        const pct = r.expected > 0 ? Math.round((r.collected / r.expected) * 100) : 0;
        return <Progress percent={pct} size="small" strokeColor={pct >= 80 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444'} style={{ width: 80 }} />;
      },
    },
  ];

  const componentCols = [
    { title: 'Component', dataIndex: 'name', key: 'name', render: (v, r) => <><Text strong>{v}</Text> {r.mandatory && <Tag color="red" style={{ fontSize: 10 }}>Mandatory</Tag>}</> },
    { title: 'Unit Amount', dataIndex: 'amount', align: 'right', render: v => `₹${(v || 0).toLocaleString('en-IN')}` },
    { title: 'Students', dataIndex: 'studentsCount', align: 'right' },
    { title: 'Total Expected', dataIndex: 'totalExpected', align: 'right', render: v => `₹${(v || 0).toLocaleString('en-IN')}` },
  ];

  return (
    <div>
      {/* Filter */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <Select
          placeholder="All Classes"
          allowClear
          style={{ width: 200 }}
          value={classId}
          onChange={setClassId}
          options={classes.map(c => ({ label: c.name, value: c._id }))}
        />
      </div>

      <Spin spinning={loading}>
        {/* KPI Cards */}
        <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
          {kpiCards.map(card => (
            <Col xs={12} sm={8} md={4} key={card.title}>
              <Card size="small" style={{
                borderRadius: 12, borderTop: `3px solid ${card.color}`,
                boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
              }}>
                <Statistic
                  title={<span style={{ fontSize: 11, color: '#64748B' }}>{card.title}</span>}
                  value={card.value}
                  prefix={<span style={{ color: card.color }}>{card.icon}</span>}
                  formatter={card.format ? card.format : v => v.toLocaleString('en-IN')}
                  valueStyle={{ fontSize: 18, fontWeight: 700, color: card.color }}
                />
              </Card>
            </Col>
          ))}
        </Row>

        {/* Collection Progress */}
        <Card style={{ marginBottom: 20, borderRadius: 12 }} size="small">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text strong>Overall Fee Collection Progress</Text>
            <Text type="secondary">{collectionPct}%</Text>
          </div>
          <Progress
            percent={collectionPct}
            strokeColor={collectionPct >= 80 ? '#22C55E' : collectionPct >= 50 ? '#F59E0B' : '#EF4444'}
            strokeWidth={12}
            style={{ marginBottom: 8 }}
          />
          <Row gutter={12}>
            <Col span={8}>
              <Text style={{ fontSize: 12 }}>
                <span style={{ color: '#22C55E' }}>●</span> Paid: {stats?.paidCount || 0}
              </Text>
            </Col>
            <Col span={8}>
              <Text style={{ fontSize: 12 }}>
                <span style={{ color: '#F59E0B' }}>●</span> Partial: {stats?.partialCount || 0}
              </Text>
            </Col>
            <Col span={8}>
              <Text style={{ fontSize: 12 }}>
                <span style={{ color: '#EF4444' }}>●</span> Unpaid: {stats?.unpaidCount || 0}
              </Text>
            </Col>
          </Row>
        </Card>

        {/* Charts Row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} md={14}>
            <Card title={<Text strong>Monthly Collection</Text>} size="small" style={{ borderRadius: 12 }}>
              {monthly.length > 0 ? (
                <MiniBarChart data={monthly} height={160} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data" />
              )}
              {/* Month totals below chart */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                {monthly.slice(0, 6).map(m => (
                  <div key={m.month} style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#64748B' }}>{m.month}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: m.collected > 0 ? '#2563EB' : '#CBD5E1' }}>
                      {m.collected > 0 ? `₹${(m.collected / 1000).toFixed(0)}K` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
          <Col xs={24} md={10}>
            <Card title={<Text strong>Status Breakdown</Text>} size="small" style={{ borderRadius: 12 }}>
              <div style={{ padding: '20px 0' }}>
                {[
                  { label: 'Fully Paid',  count: stats?.paidCount || 0,    total: stats?.totalInvoices || 1, color: '#22C55E' },
                  { label: 'Partial',     count: stats?.partialCount || 0,  total: stats?.totalInvoices || 1, color: '#F59E0B' },
                  { label: 'Unpaid',      count: stats?.unpaidCount || 0,   total: stats?.totalInvoices || 1, color: '#EF4444' },
                  { label: 'Overdue',     count: stats?.overdueCount || 0,  total: stats?.totalInvoices || 1, color: '#DC2626' },
                ].map(item => (
                  <div key={item.label} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 12 }}>{item.label}</Text>
                      <Text style={{ fontSize: 12, fontWeight: 600, color: item.color }}>{item.count}</Text>
                    </div>
                    <Progress
                      percent={item.total > 0 ? Math.round((item.count / item.total) * 100) : 0}
                      showInfo={false}
                      strokeColor={item.color}
                      size="small"
                    />
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Class-wise Dues */}
        <Card title={<Text strong><BarChartOutlined /> Class-wise Fee Collection</Text>}
          size="small" style={{ borderRadius: 12, marginBottom: 20 }}>
          <Table
            columns={classwiseCols}
            dataSource={classwise}
            rowKey={(r, i) => r._id?.toString() || i}
            pagination={false}
            size="small"
          />
        </Card>

        {/* Component Summary */}
        <Card title={<Text strong>Fee Component Summary</Text>}
          size="small" style={{ borderRadius: 12 }}>
          <Table
            columns={componentCols}
            dataSource={components}
            rowKey="_id"
            pagination={false}
            size="small"
          />
        </Card>
      </Spin>
    </div>
  );
};

export default FeeDashboard;
