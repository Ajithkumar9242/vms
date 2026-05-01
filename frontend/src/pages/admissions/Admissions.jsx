import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Tag, Button, Space, Drawer,
  Descriptions, Row, Col, Select, App, Popconfirm, Empty,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined,
} from '@ant-design/icons';
import { admissionAPI, schoolAPI } from '@/services/api';
import StatusTag from '@/components/common/StatusTag';
import ConfirmModal from '@/components/common/ConfirmModal';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const Admissions = () => {
  const { message } = App.useApp();

  // ─── State ────────────────────────────────────────────────
  const [admissions, setAdmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ status: undefined, classId: undefined });

  // Action states
  const [actionLoading, setActionLoading] = useState(null); // stores the _id being acted on
  const [rejectModal, setRejectModal] = useState({ open: false, id: null });
  const [viewDrawer, setViewDrawer] = useState({ open: false, record: null });

  // ─── Fetch admissions ─────────────────────────────────────
  const fetchAdmissions = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (filters.status) params.status = filters.status;
      if (filters.classId) params.classId = filters.classId;

      const res = await admissionAPI.getAll(params);
      setAdmissions(res.data || []);
      setPagination({
        current: res.pagination?.page || 1,
        pageSize: res.pagination?.limit || 20,
        total: res.pagination?.total || 0,
      });
    } catch (err) {
      message.error(err.message || 'Failed to load admissions');
    } finally {
      setLoading(false);
    }
  }, [filters, message]);

  // ─── Load classes for filter ──────────────────────────────
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const res = await schoolAPI.getClasses({ limit: 50 });
        setClasses(res.data || []);
      } catch {
        // Non-critical
      }
    };
    loadClasses();
  }, []);

  useEffect(() => {
    fetchAdmissions(1, pagination.pageSize);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Approve action ───────────────────────────────────────
  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await admissionAPI.approve(id);
      message.success('Admission approved — student record created');
      fetchAdmissions(pagination.current, pagination.pageSize);
    } catch (err) {
      message.error(err.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Reject action ───────────────────────────────────────
  const openRejectModal = (id) => {
    setRejectModal({ open: true, id });
  };

  const handleReject = async (remarks) => {
    if (!remarks.trim()) {
      message.warning('Please provide remarks for rejection');
      return;
    }
    setActionLoading(rejectModal.id);
    try {
      await admissionAPI.reject(rejectModal.id, { remarks });
      message.success('Admission rejected');
      setRejectModal({ open: false, id: null });
      fetchAdmissions(pagination.current, pagination.pageSize);
    } catch (err) {
      message.error(err.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── View drawer ──────────────────────────────────────────
  const openViewDrawer = (record) => {
    setViewDrawer({ open: true, record });
  };

  // ─── Table columns ────────────────────────────────────────
  const columns = [
    {
      title: 'Application No',
      dataIndex: 'applicationNo',
      key: 'applicationNo',
      width: 160,
      fixed: 'left',
      render: (text) => <Text strong style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: 'Student Name',
      dataIndex: 'studentName',
      key: 'studentName',
      width: 170,
    },
    {
      title: 'Class',
      dataIndex: ['classId', 'name'],
      key: 'class',
      width: 110,
    },
    {
      title: 'Parent',
      dataIndex: 'parentName',
      key: 'parentName',
      width: 150,
      responsive: ['md'],
    },
    {
      title: 'Phone',
      dataIndex: 'parentPhone',
      key: 'parentPhone',
      width: 130,
      responsive: ['lg'],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: 'Applied',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      responsive: ['lg'],
      render: (date) => dayjs(date).format('DD MMM YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, record) => {
        const isPending = record.status === 'pending';
        const isProcessing = actionLoading === record._id;

        return (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openViewDrawer(record)}
              id={`view-btn-${record._id}`}
            >
              View
            </Button>

            <Popconfirm
              title="Approve this admission?"
              description="A student record will be created."
              onConfirm={() => handleApprove(record._id)}
              okText="Yes, Approve"
              okButtonProps={{ loading: isProcessing }}
              disabled={!isPending}
            >
              <Button
                type="link"
                size="small"
                style={{ color: isPending ? '#22C55E' : undefined }}
                icon={<CheckCircleOutlined />}
                loading={isProcessing}
                disabled={!isPending}
                id={`approve-btn-${record._id}`}
              >
                Approve
              </Button>
            </Popconfirm>

            <Button
              type="link"
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => openRejectModal(record._id)}
              disabled={!isPending}
              id={`reject-btn-${record._id}`}
            >
              Reject
            </Button>
          </Space>
        );
      },
    },
  ];

  const handleTableChange = (pag) => {
    fetchAdmissions(pag.current, pag.pageSize);
  };

  const viewRecord = viewDrawer.record;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <Title level={4} className="page-title" style={{ margin: 0 }}>
          Admissions
        </Title>
        <Text type="secondary">
          Manage admission applications
        </Text>
      </div>

      {/* Filters */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={5}>
          <Select
            placeholder="Filter by status"
            allowClear
            style={{ width: '100%' }}
            value={filters.status}
            onChange={(val) => setFilters((prev) => ({ ...prev, status: val }))}
            options={[
              { label: 'Pending', value: 'pending' },
              { label: 'Approved', value: 'approved' },
              { label: 'Rejected', value: 'rejected' },
            ]}
            id="admission-status-filter"
          />
        </Col>
        <Col xs={12} sm={8} md={5}>
          <Select
            placeholder="Filter by class"
            allowClear
            style={{ width: '100%' }}
            value={filters.classId}
            onChange={(val) => setFilters((prev) => ({ ...prev, classId: val }))}
            options={classes.map((c) => ({ label: c.name, value: c._id }))}
            id="admission-class-filter"
          />
        </Col>
      </Row>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={admissions}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} applications`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 1040 }}
        size="middle"
        bordered={false}
        style={{ background: '#FFF', borderRadius: 8 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No admission applications found"
            />
          ),
        }}
      />

      {/* ─── Reject Modal (Reusable ConfirmModal) ──────────── */}
      <ConfirmModal
        open={rejectModal.open}
        title="Reject Admission"
        description="Please provide a reason for rejection:"
        okText="Reject"
        okType="danger"
        loading={!!actionLoading}
        requireInput
        inputLabel="Enter remarks..."
        onConfirm={handleReject}
        onCancel={() => setRejectModal({ open: false, id: null })}
      />

      {/* ─── View Drawer ───────────────────────────────────── */}
      <Drawer
        title={`Application: ${viewRecord?.applicationNo || ''}`}
        open={viewDrawer.open}
        onClose={() => setViewDrawer({ open: false, record: null })}
        width={480}
        destroyOnClose
      >
        {viewRecord && (
          <Descriptions column={1} bordered size="small" labelStyle={{ width: 140, fontWeight: 500 }}>
            <Descriptions.Item label="Application No">{viewRecord.applicationNo}</Descriptions.Item>
            <Descriptions.Item label="Student Name">{viewRecord.studentName}</Descriptions.Item>
            <Descriptions.Item label="Date of Birth">
              {viewRecord.dateOfBirth ? dayjs(viewRecord.dateOfBirth).format('DD MMM YYYY') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Gender">
              <span style={{ textTransform: 'capitalize' }}>{viewRecord.gender}</span>
            </Descriptions.Item>
            <Descriptions.Item label="Class">{viewRecord.classId?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Section">{viewRecord.sectionId?.name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Parent Name">{viewRecord.parentName}</Descriptions.Item>
            <Descriptions.Item label="Parent Phone">{viewRecord.parentPhone}</Descriptions.Item>
            <Descriptions.Item label="Parent Email">{viewRecord.parentEmail || '—'}</Descriptions.Item>
            <Descriptions.Item label="Address">{viewRecord.address || '—'}</Descriptions.Item>
            <Descriptions.Item label="Previous School">{viewRecord.previousSchool || '—'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <StatusTag status={viewRecord.status} />
            </Descriptions.Item>
            {viewRecord.remarks && (
              <Descriptions.Item label="Remarks">{viewRecord.remarks}</Descriptions.Item>
            )}
            {viewRecord.approvedBy && (
              <Descriptions.Item label="Processed By">
                {viewRecord.approvedBy?.name || viewRecord.approvedBy}
              </Descriptions.Item>
            )}
            {viewRecord.approvedAt && (
              <Descriptions.Item label="Processed At">
                {dayjs(viewRecord.approvedAt).format('DD MMM YYYY, hh:mm A')}
              </Descriptions.Item>
            )}
            {viewRecord.studentId && (
              <Descriptions.Item label="Student Record">
                <Tag color="blue">{viewRecord.studentId?.rollNo || viewRecord.studentId}</Tag>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Applied On">
              {dayjs(viewRecord.createdAt).format('DD MMM YYYY, hh:mm A')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

export default Admissions;
