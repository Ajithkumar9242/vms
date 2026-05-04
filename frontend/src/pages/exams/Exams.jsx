import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography, Select, Row, Col, Table, Button, Tag, App,
  Empty, Popconfirm, Space, Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  LockOutlined, CheckCircleOutlined, EyeOutlined,
} from '@ant-design/icons';
import { examAPI, schoolAPI } from '@/services/api';
import CreateExamModal from './CreateExamModal';
import MarksEntry from './MarksEntry';
import ExamResults from './ExamResults';

const { Title, Text } = Typography;

// ── Status badge ────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const MAP = {
    draft:     { color: 'default', text: '🟡 Draft' },
    published: { color: 'green',   text: '🟢 Published' },
    locked:    { color: 'red',     text: '🔒 Locked' },
  };
  const { color, text } = MAP[status] || MAP.draft;
  return <Tag color={color} style={{ fontWeight: 600 }}>{text}</Tag>;
};

// ── Date formatter ──────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ═══════════════════════════════════════════════════════════
const Exams = () => {
  const { message, modal } = App.useApp();
  const [tab, setTab] = useState('exams');

  // ── Exams list ─────────────────────────────────────────────
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [classFilter, setClassFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);

  // ── Modal ─────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  // ── Results view ──────────────────────────────────────────
  const [resultsExamId, setResultsExamId] = useState(null);

  // ── Load data ─────────────────────────────────────────────
  const fetchExams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await examAPI.getAll({ classId: classFilter, status: statusFilter });
      setExams(res?.data || []);
    } catch (err) {
      message.error(err.message || 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  }, [classFilter, statusFilter, message]);

  useEffect(() => {
    schoolAPI.getClasses({ limit: 50 }).then((r) => {
      const list = r?.data?.classes || r?.data || [];
      setClasses(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (tab === 'exams') fetchExams(); }, [fetchExams, tab]);

  // ── Actions ───────────────────────────────────────────────
  const handlePublish = async (exam) => {
    modal.confirm({
      title: `Publish "${exam.examName || exam.name}"?`,
      content: 'Once published, exam metadata cannot be edited. Marks entry will be enabled.',
      okText: 'Publish',
      onOk: async () => {
        try {
          await examAPI.publish(exam._id);
          message.success('Exam published');
          fetchExams();
        } catch (e) { message.error(e.message); }
      },
    });
  };

  const handleLock = async (exam) => {
    modal.confirm({
      title: `Lock "${exam.examName || exam.name}"?`,
      content: 'Once locked, no more marks can be edited. Results are finalized.',
      okText: 'Lock Exam',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await examAPI.lock(exam._id);
          message.success('Exam locked');
          fetchExams();
        } catch (e) { message.error(e.message); }
      },
    });
  };

  const handleDelete = async (exam) => {
    try {
      await examAPI.remove(exam._id);
      message.success('Exam deleted');
      fetchExams();
    } catch (e) { message.error(e.message); }
  };

  // ── Columns ───────────────────────────────────────────────
  const columns = [
    {
      title: 'Exam Name', key: 'name', width: 190,
      render: (_, r) => <Text strong>{r.examName || r.name}</Text>,
    },
    {
      title: 'Class', key: 'class', width: 110,
      render: (_, r) => r.classId?.name || '—',
    },
    {
      title: 'Subjects', key: 'subjects', width: 80, align: 'center',
      render: (_, r) => (
        <Tag color="blue">{(r.subjects || []).length} subj.</Tag>
      ),
    },
    {
      title: 'Max / Pass', key: 'marks', width: 110, align: 'center',
      render: (_, r) => (
        <span>
          <Text strong>{r.maxMarks}</Text>
          <Text type="secondary"> / {r.passingMarks}</Text>
        </span>
      ),
    },
    {
      title: 'Date', key: 'date', width: 140,
      render: (_, r) => {
        const s = r.startDate;
        const e = r.endDate;
        if (s && e) return <>{fmtDate(s)}<br /><Text type="secondary" style={{ fontSize: 11 }}>to {fmtDate(e)}</Text></>;
        return fmtDate(s);
      },
    },
    {
      title: 'Status', key: 'status', width: 120,
      render: (_, r) => <StatusBadge status={r.status} />,
    },
    {
      title: 'Actions', key: 'actions', width: 230, fixed: 'right',
      render: (_, r) => (
        <Space size={4} wrap>
          {/* View Results */}
          <Tooltip title="View Results">
            <Button
              size="small" icon={<EyeOutlined />}
              onClick={() => { setResultsExamId(r._id); setTab('results'); }}
            />
          </Tooltip>

          {/* Edit — Draft or Published (admin can edit published) */}
          {(r.status === 'draft' || r.status === 'published') && (
            <Tooltip title="Edit">
              <Button
                size="small" icon={<EditOutlined />}
                onClick={() => { setEditRecord(r); setModalOpen(true); }}
              />
            </Tooltip>
          )}

          {/* Publish — only Draft */}
          {r.status === 'draft' && (
            <Tooltip title="Publish">
              <Button
                size="small" type="primary" icon={<CheckCircleOutlined />}
                onClick={() => handlePublish(r)}
              >
                Publish
              </Button>
            </Tooltip>
          )}

          {/* Lock — only Published */}
          {r.status === 'published' && (
            <Tooltip title="Lock & Finalize">
              <Button
                size="small" danger icon={<LockOutlined />}
                onClick={() => handleLock(r)}
              >
                Lock
              </Button>
            </Tooltip>
          )}

          {/* Delete — only Draft */}
          {r.status === 'draft' && (
            <Popconfirm
              title="Delete this exam?"
              description="This action cannot be undone."
              onConfirm={() => handleDelete(r)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // ── Tab navigation ────────────────────────────────────────
  const TABS = [
    { key: 'exams',   label: '📋 Exams' },
    { key: 'marks',   label: '✏️ Marks Entry' },
    { key: 'results', label: '📊 Results' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Title level={4} className="page-title" style={{ margin: 0 }}>
          Exams & Results
        </Title>
        <Text type="secondary">Manage exams, enter marks, and view results</Text>
      </div>

      {/* ── Custom tab bar ───────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid #e5e7eb', paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid #1677ff' : '2px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? '#1677ff' : '#6b7280',
              fontSize: 14,
              transition: 'all 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ════ EXAMS TAB ════════════════════════════════════ */}
      {tab === 'exams' && (
        <>
          {/* Toolbar */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }} justify="space-between" align="middle">
            <Col>
              <Space>
                <Select
                  placeholder="All classes"
                  style={{ width: 160 }}
                  value={classFilter}
                  onChange={setClassFilter}
                  options={classes.map((c) => ({ label: c.name, value: c._id }))}
                  allowClear
                  id="exams-class-filter"
                />
                <Select
                  placeholder="All statuses"
                  style={{ width: 150 }}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { label: '🟡 Draft', value: 'draft' },
                    { label: '🟢 Published', value: 'published' },
                    { label: '🔒 Locked', value: 'locked' },
                  ]}
                  allowClear
                  id="exams-status-filter"
                />
              </Space>
            </Col>
            <Col>
              <Button
                type="primary" icon={<PlusOutlined />}
                onClick={() => { setEditRecord(null); setModalOpen(true); }}
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
            pagination={{ showSizeChanger: true, pageSize: 20, showTotal: (t) => `Total ${t} exams` }}
            scroll={{ x: 1000 }}
            size="middle"
            bordered={false}
            style={{ background: '#fff', borderRadius: 8 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No exams found" /> }}
          />

          <CreateExamModal
            open={modalOpen}
            editRecord={editRecord}
            onClose={() => { setModalOpen(false); setEditRecord(null); }}
            onSuccess={() => { setModalOpen(false); setEditRecord(null); fetchExams(); }}
          />
        </>
      )}

      {/* ════ MARKS ENTRY TAB ══════════════════════════════ */}
      {tab === 'marks' && <MarksEntry />}

      {/* ════ RESULTS TAB ══════════════════════════════════ */}
      {tab === 'results' && (
        <ExamResults initialExamId={resultsExamId} onClearExamId={() => setResultsExamId(null)} />
      )}
    </div>
  );
};

export default Exams;
