import React, { useEffect, useState, useCallback } from 'react';
import { Table, Typography, Input, Select, Row, Col, App, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { studentAPI, schoolAPI } from '@/services/api';
import StatusTag from '@/components/common/StatusTag';

const { Title, Text } = Typography;

const Students = () => {
  const { message } = App.useApp();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({ search: '', classId: undefined });

  // ─── Fetch students ───────────────────────────────────────
  const fetchStudents = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (filters.search) params.search = filters.search;
      if (filters.classId) params.classId = filters.classId;

      const res = await studentAPI.getAll(params);
      setStudents(res.data || []);
      setPagination({
        current: res.pagination?.page || 1,
        pageSize: res.pagination?.limit || 20,
        total: res.pagination?.total || 0,
      });
    } catch (err) {
      message.error(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [filters, message]);

  // ─── Fetch classes for filter dropdown ────────────────────
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const res = await schoolAPI.getClasses({ limit: 50 });
        setClasses(res.data || []);
      } catch {
        // Non-critical — filter just won't have options
      }
    };
    loadClasses();
  }, []);

  // ─── Reload on filter change ──────────────────────────────
  useEffect(() => {
    fetchStudents(1, pagination.pageSize);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Table columns ────────────────────────────────────────
  const columns = [
    {
      title: 'Roll No',
      dataIndex: 'rollNo',
      key: 'rollNo',
      width: 150,
      fixed: 'left',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Class',
      dataIndex: ['classId', 'name'],
      key: 'class',
      width: 120,
    },
    {
      title: 'Section',
      dataIndex: ['sectionId', 'name'],
      key: 'section',
      width: 90,
      render: (text) => text || '—',
    },
    {
      title: 'Parent Name',
      dataIndex: 'parentName',
      key: 'parentName',
      width: 160,
    },
    {
      title: 'Parent Phone',
      dataIndex: 'parentPhone',
      key: 'parentPhone',
      width: 140,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      width: 100,
      render: (isActive) => <StatusTag status={isActive ? 'active' : 'inactive'} />,
    },
  ];

  // ─── Table change (pagination) ────────────────────────────
  const handleTableChange = (pag) => {
    fetchStudents(pag.current, pag.pageSize);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <Title level={4} className="page-title" style={{ margin: 0 }}>
          Students
        </Title>
        <Text type="secondary">
          Manage enrolled students
        </Text>
      </div>

      {/* Filters */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Input
            placeholder="Search by name or roll no..."
            prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
            allowClear
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
            id="student-search"
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Select
            placeholder="Filter by class"
            allowClear
            style={{ width: '100%' }}
            value={filters.classId}
            onChange={(val) => setFilters((prev) => ({ ...prev, classId: val }))}
            options={classes.map((c) => ({ label: c.name, value: c._id }))}
            id="student-class-filter"
          />
        </Col>
      </Row>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={students}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} students`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 940 }}
        size="middle"
        bordered={false}
        style={{ background: '#FFF', borderRadius: 8 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No students found"
            />
          ),
        }}
      />
    </div>
  );
};

export default Students;
