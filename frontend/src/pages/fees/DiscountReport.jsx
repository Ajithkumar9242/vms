import React, { useEffect, useState, useCallback } from 'react';
import { Typography, Table, Tag, Empty, App, Row, Col, Select, Input, Button } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { feesAPI, schoolAPI, setupAPI } from '@/services/api';

const { Title, Text } = Typography;

const DiscountReport = () => {
  const { message } = App.useApp();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [classFilter, setClassFilter] = useState(undefined);
  const [yearFilter, setYearFilter] = useState(undefined);
  const [search, setSearch] = useState('');

  const fetchFilters = useCallback(async () => {
    try {
      const [classRes, yearRes] = await Promise.all([
        schoolAPI.getClasses({ limit: 50 }),
        setupAPI.getAcademicYears()
      ]);
      const classList = classRes?.data?.classes || classRes?.data || [];
      const yearList = yearRes?.data || [];
      setClasses(Array.isArray(classList) ? classList : []);
      setAcademicYears(Array.isArray(yearList) ? yearList : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const fetchDiscounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await feesAPI.getDiscounts({
        classId: classFilter,
        academicYearId: yearFilter,
      });
      setData(res?.data || []);
    } catch (err) {
      message.error(err.message || 'Failed to fetch discounts');
    } finally {
      setLoading(false);
    }
  }, [classFilter, yearFilter, message]);

  useEffect(() => {
    fetchDiscounts();
  }, [fetchDiscounts]);

  const filteredData = React.useMemo(() => {
    return data.filter(item => {
      if (!search) return true;
      const q = search.toLowerCase();
      const st = item.student || {};
      return (st.name || '').toLowerCase().includes(q) ||
             (st.admissionNo || '').toLowerCase().includes(q) ||
             (st.rollNo || '').toLowerCase().includes(q) ||
             (item.discount?.label || '').toLowerCase().includes(q);
    });
  }, [data, search]);

  const columns = [
    {
      title: 'Student Name',
      key: 'name',
      render: (_, r) => <Text strong>{r.student?.name}</Text>,
    },
    {
      title: 'Admission No',
      key: 'admNo',
      render: (_, r) => r.student?.admissionNo || '—',
    },
    {
      title: 'Class',
      key: 'class',
      render: (_, r) => r.class?.name || '—',
    },
    {
      title: 'Discount Reason',
      key: 'label',
      render: (_, r) => r.discount?.label || r.discount?.reason || r.discount?.type,
    },
    {
      title: 'Discount Type',
      key: 'type',
      render: (_, r) => <Tag color="blue">{r.discount?.type}</Tag>,
    },
    {
      title: 'Value',
      key: 'value',
      align: 'right',
      render: (_, r) => (
        <Text strong type="danger">
          {r.discount?.discountType === 'percent' ? `${r.discount.value}%` : `₹${r.discount?.value}`}
        </Text>
      ),
    },
    {
      title: 'Net Fee',
      key: 'netFee',
      align: 'right',
      render: (_, r) => `₹${r.netFee}`,
    },
    {
      title: 'Invoice',
      key: 'invoice',
      render: (_, r) => (
        r.invoice ? (
          <span>
            {r.invoice.invoiceNumber} <br />
            <Tag color={r.invoice.status === 'paid' ? 'green' : r.invoice.status === 'overdue' ? 'red' : 'default'} style={{marginTop: 4}}>
              {r.invoice.status}
            </Tag>
          </span>
        ) : '—'
      ),
    },
    {
      title: 'Applied On',
      key: 'applied',
      render: (_, r) => {
        const d = r.discount?.appliedAt;
        return d ? new Date(d).toLocaleDateString() : '—';
      },
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>Discount List</Title>
          <Text type="secondary">Report of students who received fee discounts</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchDiscounts} loading={loading}>
          Refresh
        </Button>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Select
          placeholder="Academic Year"
          style={{ width: 160 }}
          value={yearFilter}
          onChange={setYearFilter}
          options={academicYears.map((y) => ({ label: y.name, value: y._id }))}
          allowClear
        />
        <Select
          placeholder="All classes"
          style={{ width: 160 }}
          value={classFilter}
          onChange={setClassFilter}
          options={classes.map((c) => ({ label: c.name, value: c._id }))}
          allowClear
          showSearch
          optionFilterProp="label"
        />
        <Input
          placeholder="Search student or discount reason..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          style={{ width: 300 }}
          allowClear
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey={(r, i) => `${r.student?._id}_${i}`}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `Total ${t} discounts` }}
        scroll={{ x: 1000 }}
        size="middle"
        style={{ background: '#fff', borderRadius: 8 }}
        locale={{ emptyText: <Empty description="No discounts found" /> }}
      />
    </div>
  );
};

export default DiscountReport;
