import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Select,
  Row,
  Col,
  Table,
  Button,
  Tag,
  Tabs,
  App,
  Empty,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { examAPI, schoolAPI } from '@/services/api';
import CreateExamModal from './CreateExamModal';
import MarksEntry from './MarksEntry';
import StudentResults from './StudentResults';

const { Title, Text } = Typography;

const Exams = () => {
  const { message } = App.useApp();

  // ─── Exams list state ─────────────────────────────────────
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classFilter, setClassFilter] = useState(undefined);
  const [createModal, setCreateModal] = useState(false);

  // ─── Fetch exams ──────────────────────────────────────────
  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (classFilter) params.classId = classFilter;
      const res = await examAPI.getAll(params);
      setExams(res.data || []);
    } catch (err) {
      message.error(err.message || 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  }, [classFilter, message]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await schoolAPI.getClasses({ limit: 50 });
        setClasses(res.data || []);
      } catch { /* */ }
    };
    load();
  }, []);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  // ─── Exam list columns ────────────────────────────────────
  const columns = [
    {
      title: 'Exam Name',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Class',
      key: 'class',
      width: 120,
      render: (_, r) => r.classId?.name || '—',
    },
    {
      title: 'Subjects',
      key: 'subjects',
      width: 280,
      render: (_, r) =>
        (r.subjects || []).map((se) => {
          const sub = se.subjectId || {};
          return (
            <Tag color="blue" key={String(sub._id || se._id)} style={{ marginBottom: 2 }}>
              {sub.name || sub.code || '—'} ({se.maxMarks})
            </Tag>
          );
        }),
    },
    {
      title: 'Max Marks',
      dataIndex: 'maxMarks',
      key: 'maxMarks',
      width: 100,
      align: 'center',
    },
    {
      title: 'Passing',
      dataIndex: 'passingMarks',
      key: 'passingMarks',
      width: 90,
      align: 'center',
    },
    {
      title: 'Date',
      dataIndex: 'examDate',
      key: 'examDate',
      width: 120,
      render: (val) =>
        val
          ? new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—',
    },
  ];

  // ═══════════════════════════════════════════════════════════
  //  TAB ITEMS
  // ═══════════════════════════════════════════════════════════

  const tabItems = [
    {
      key: 'exams',
      label: 'Exams',
      children: (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }} justify="space-between" align="middle">
            <Col xs={24} sm={8} md={6}>
              <Select
                placeholder="Filter by class"
                style={{ width: '100%' }}
                value={classFilter}
                onChange={(val) => setClassFilter(val)}
                options={classes.map((c) => ({ label: c.name, value: c._id }))}
                allowClear
                id="exams-class-filter"
              />
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModal(true)}
                id="create-exam-btn"
              >
                Create Exam
              </Button>
            </Col>
          </Row>

          <Table
            columns={columns}
            dataSource={exams}
            rowKey="_id"
            loading={loading}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} exams`,
              pageSize: 20,
            }}
            scroll={{ x: 980 }}
            size="middle"
            bordered={false}
            style={{ background: '#FFF', borderRadius: 8 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No exams found"
                />
              ),
            }}
          />

          <CreateExamModal
            open={createModal}
            onClose={() => setCreateModal(false)}
            onSuccess={() => {
              setCreateModal(false);
              fetchExams();
            }}
          />
        </>
      ),
    },
    {
      key: 'marks',
      label: 'Marks Entry',
      children: <MarksEntry />,
    },
    {
      key: 'results',
      label: 'Results',
      children: <StudentResults />,
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Title level={4} className="page-title" style={{ margin: 0 }}>
          Exams & Results
        </Title>
        <Text type="secondary">Create exams, enter marks, and view results</Text>
      </div>

      <Tabs
        defaultActiveKey="exams"
        items={tabItems}
        type="card"
        size="large"
        style={{ marginTop: 8 }}
      />
    </div>
  );
};

export default Exams;
