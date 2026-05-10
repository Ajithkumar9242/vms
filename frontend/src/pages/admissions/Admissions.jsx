import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, App, Select, Input, Modal,
  Form, Drawer, Badge, Tooltip, Row, Col, Card, Statistic,
  Switch, Spin, Alert, Divider, Popconfirm,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, PauseCircleOutlined,
  EditOutlined, PlusOutlined, SearchOutlined, ReloadOutlined,
  LockOutlined, UnlockOutlined, SettingOutlined, EyeOutlined,
} from '@ant-design/icons';
import { admissionAPI, setupAPI } from '@/services/api';
import AdmissionFormDrawer from './AdmissionFormDrawer';

const { Search } = Input;

const STATUS_COLORS = {
  pending:  'blue',
  approved: 'green',
  rejected: 'red',
  hold:     'orange',
};

const STATUS_ICONS = {
  pending:  null,
  approved: <CheckCircleOutlined />,
  rejected: <CloseCircleOutlined />,
  hold:     <PauseCircleOutlined />,
};

const Admissions = () => {
  const { message, modal } = App.useApp();

  // ─── State ──────────────────────────────────────────────────
  const [admissions, setAdmissions]   = useState([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchPhone, setSearchPhone] = useState('');

  // Settings state
  const [settings, setSettings]         = useState({ admissionsOpen: false, activeAdmissionAcademicYearId: null });
  const [academicYears, setAcademicYears] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Action modals
  const [remarkModal, setRemarkModal]   = useState({ open: false, type: '', id: '', name: '' });
  const [remarkText, setRemarkText]     = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Drawer
  const [formDrawer, setFormDrawer]   = useState({ open: false, admission: null });

  // ─── Load settings ──────────────────────────────────────────
  const loadSettings = useCallback(async () => {
    try {
      const res = await admissionAPI.getSettings();
      setSettings(res.data || res);
    } catch { /* silent */ }
  }, []);

  const loadAcademicYears = useCallback(async () => {
    try {
      const res = await setupAPI.getAcademicYears();
      setAcademicYears((res.data || res).map(y => ({ label: y.name, value: y._id })));
    } catch { /* silent */ }
  }, []);

  // ─── Load admissions ────────────────────────────────────────
  const loadAdmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (statusFilter) params.status = statusFilter;
      if (searchPhone)  params.phone  = searchPhone;
      const res = await admissionAPI.getAll(params);
      const data = res.data || res;
      setAdmissions(data.admissions || data);
      setTotal(data.total || (data.admissions || data).length);
    } catch (e) {
      message.error(e.message || 'Failed to load admissions');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchPhone, message]);

  useEffect(() => { loadSettings(); loadAcademicYears(); }, [loadSettings, loadAcademicYears]);
  useEffect(() => { loadAdmissions(); }, [loadAdmissions]);

  // ─── Settings toggle ────────────────────────────────────────
  const handleToggleOpen = async (value) => {
    setSettingsLoading(true);
    try {
      await admissionAPI.updateSettings({ admissionsOpen: value });
      setSettings(s => ({ ...s, admissionsOpen: value }));
      message.success(`Admissions ${value ? 'OPENED' : 'CLOSED'} successfully`);
    } catch (e) {
      message.error(e.message || 'Failed to update settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleChangeActiveYear = async (yearId) => {
    setSettingsLoading(true);
    try {
      await admissionAPI.updateSettings({ activeAdmissionAcademicYearId: yearId });
      setSettings(s => ({ ...s, activeAdmissionAcademicYearId: yearId }));
      message.success('Active admission year updated');
    } catch (e) {
      message.error(e.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  // ─── Action helpers ─────────────────────────────────────────
  const openRemarkModal = (type, id, name) => {
    setRemarkText('');
    setRemarkModal({ open: true, type, id, name });
  };

  const handleAction = async () => {
    const { type, id } = remarkModal;
    setActionLoading(true);
    try {
      if (type === 'approve') {
        await admissionAPI.approve(id, { remarks: remarkText });
        message.success('Admission approved!');
      } else if (type === 'reject') {
        await admissionAPI.reject(id, { remarks: remarkText });
        message.success('Admission rejected');
      } else if (type === 'hold') {
        await admissionAPI.hold(id, { remarks: remarkText });
        message.success('Admission placed on hold');
      }
      setRemarkModal({ open: false, type: '', id: '', name: '' });
      loadAdmissions();
    } catch (e) {
      message.error(e.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Table columns ──────────────────────────────────────────
  const columns = [
    {
      title: 'App No',
      dataIndex: 'applicationNo',
      key: 'applicationNo',
      width: 130,
      render: (v) => <code style={{ fontSize: 11 }}>{v}</code>,
    },
    {
      title: 'Student',
      dataIndex: 'studentName',
      key: 'studentName',
      render: (name, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>{r.classId?.name || '—'}</div>
        </div>
      ),
    },
    {
      title: 'Parent / Phone',
      key: 'parent',
      render: (_, r) => (
        <div>
          <div>{r.father?.name || r.parentName}</div>
          <div style={{ fontSize: 11, color: '#64748B' }}>{r.parentPhone}</div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'boardingType',
      key: 'boardingType',
      width: 100,
      render: (v) => <Tag color={v === 'residential' ? 'purple' : 'cyan'}>{v || 'Day-Boarding'}</Tag>,
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 80,
      render: (v) => <Tag>{v || 'offline'}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s) => (
        <Tag color={STATUS_COLORS[s] || 'default'} icon={STATUS_ICONS[s]}>
          {(s || 'pending').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (v) => new Date(v).toLocaleDateString('en-IN'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="View / Edit">
            <Button size="small" icon={<EyeOutlined />}
              onClick={() => setFormDrawer({ open: true, admission: r })} />
          </Tooltip>
          {r.status === 'pending' || r.status === 'hold' ? (
            <>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                onClick={() => openRemarkModal('approve', r._id, r.studentName)}>
                Approve
              </Button>
              {r.status !== 'hold' && (
                <Button size="small" icon={<PauseCircleOutlined />} style={{ color: '#D97706', borderColor: '#D97706' }}
                  onClick={() => openRemarkModal('hold', r._id, r.studentName)}>
                  Hold
                </Button>
              )}
              <Button size="small" danger icon={<CloseCircleOutlined />}
                onClick={() => openRemarkModal('reject', r._id, r.studentName)}>
                Reject
              </Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  // ─── Stats ──────────────────────────────────────────────────
  const stats = {
    total:    admissions.length,
    pending:  admissions.filter(a => a.status === 'pending').length,
    approved: admissions.filter(a => a.status === 'approved').length,
    hold:     admissions.filter(a => a.status === 'hold').length,
    rejected: admissions.filter(a => a.status === 'rejected').length,
  };

  return (
    <div style={{ padding: '0 0 40px' }}>
      {/* ─── Admission Control Banner ─────────────────────── */}
      <Card
        style={{ marginBottom: 20, borderRadius: 12, background: settings.admissionsOpen ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${settings.admissionsOpen ? '#86EFAC' : '#FCA5A5'}` }}
        bodyStyle={{ padding: '16px 20px' }}
      >
        <Row gutter={16} align="middle" wrap={false}>
          <Col flex="auto">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SettingOutlined style={{ fontSize: 20, color: settings.admissionsOpen ? '#16A34A' : '#DC2626' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  Admission Status:&nbsp;
                  <span style={{ color: settings.admissionsOpen ? '#16A34A' : '#DC2626' }}>
                    {settings.admissionsOpen ? '🟢 OPEN' : '🔴 CLOSED'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {settings.admissionsOpen
                    ? 'Public admission form is accepting applications'
                    : 'Public form is blocked — no new applications will be accepted'}
                </div>
              </div>
            </div>
          </Col>
          <Col>
            <Space>
              <Select
                placeholder="Active Admission Year"
                style={{ width: 200 }}
                value={settings.activeAdmissionAcademicYearId?._id || settings.activeAdmissionAcademicYearId}
                onChange={handleChangeActiveYear}
                options={academicYears}
                allowClear
                size="small"
                id="admission-year-select"
              />
              <Spin spinning={settingsLoading}>
                <Switch
                  checked={settings.admissionsOpen}
                  onChange={handleToggleOpen}
                  checkedChildren="OPEN"
                  unCheckedChildren="CLOSED"
                  style={{ minWidth: 80 }}
                  id="admission-toggle"
                />
              </Spin>
              <Button icon={<PlusOutlined />} type="primary"
                onClick={() => setFormDrawer({ open: true, admission: null })}
                id="btn-new-admission">
                New Application
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ─── Stats Row ───────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Total', value: stats.total,    color: '#3B82F6' },
          { label: 'Pending', value: stats.pending,  color: '#F59E0B' },
          { label: 'Approved', value: stats.approved, color: '#10B981' },
          { label: 'On Hold', value: stats.hold,     color: '#F97316' },
          { label: 'Rejected', value: stats.rejected, color: '#EF4444' },
        ].map(s => (
          <Col xs={12} sm={8} md={4} key={s.label}>
            <Card size="small" style={{ borderRadius: 10, borderTop: `3px solid ${s.color}`, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>{s.label}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* ─── Filters ─────────────────────────────────────── */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col>
          <Select
            placeholder="Filter by status"
            style={{ width: 160 }}
            value={statusFilter || undefined}
            onChange={v => { setStatusFilter(v || ''); setPage(1); }}
            allowClear
            options={[
              { label: 'All', value: '' },
              { label: 'Pending', value: 'pending' },
              { label: 'Approved', value: 'approved' },
              { label: 'On Hold', value: 'hold' },
              { label: 'Rejected', value: 'rejected' },
            ]}
          />
        </Col>
        <Col flex="auto">
          <Search placeholder="Search by parent phone..." allowClear
            onSearch={v => { setSearchPhone(v); setPage(1); }}
            style={{ maxWidth: 300 }}
          />
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={loadAdmissions}>Refresh</Button>
        </Col>
      </Row>

      {/* ─── Table ───────────────────────────────────────── */}
      <Table
        columns={columns}
        dataSource={admissions}
        rowKey="_id"
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{
          current: page, total, pageSize: 15,
          onChange: (p) => setPage(p),
          showTotal: (t) => `${t} applications`,
        }}
        size="small"
        bordered
        style={{ background: '#fff', borderRadius: 8 }}
        rowClassName={(r) => r.status === 'hold' ? 'ant-table-row-warning' : ''}
      />

      {/* ─── Action Remark Modal ─────────────────────────── */}
      <Modal
        open={remarkModal.open}
        title={
          remarkModal.type === 'approve' ? `✅ Approve — ${remarkModal.name}` :
          remarkModal.type === 'hold'    ? `⏸ Hold — ${remarkModal.name}` :
                                          `❌ Reject — ${remarkModal.name}`
        }
        onOk={handleAction}
        onCancel={() => setRemarkModal({ open: false, type: '', id: '', name: '' })}
        okText={remarkModal.type === 'approve' ? 'Approve' : remarkModal.type === 'hold' ? 'Place on Hold' : 'Reject'}
        okButtonProps={{
          danger: remarkModal.type === 'reject',
          loading: actionLoading,
          style: remarkModal.type === 'hold' ? { background: '#F97316', borderColor: '#F97316' } : {},
        }}
        destroyOnClose
      >
        <p style={{ marginBottom: 12, color: '#64748B', fontSize: 13 }}>
          {remarkModal.type === 'approve'
            ? 'Approving will create a student record. You can optionally add a remark.'
            : remarkModal.type === 'hold'
            ? 'Enter the reason for placing this application on hold (sent to parent).'
            : 'Enter the reason for rejection (sent to parent).'}
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Remarks (optional)"
          value={remarkText}
          onChange={e => setRemarkText(e.target.value)}
          autoFocus
        />
      </Modal>

      {/* ─── Form Drawer ─────────────────────────────────── */}
      <AdmissionFormDrawer
        open={formDrawer.open}
        admission={formDrawer.admission}
        onClose={() => setFormDrawer({ open: false, admission: null })}
        onSuccess={() => { setFormDrawer({ open: false, admission: null }); loadAdmissions(); }}
      />
    </div>
  );
};

export default Admissions;
