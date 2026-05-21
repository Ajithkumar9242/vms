import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography, Select, Row, Col, Table, Tag, Empty, App,
  Statistic, Card, Input,
  Button,
} from 'antd';
import {
  TrophyOutlined, CheckCircleFilled, CloseCircleFilled,
  UserOutlined, PercentageOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import { examAPI, schoolAPI } from '@/services/api';

const { Text, Title } = Typography;

const GRADE_COLOR = {
  'A+': 'green', A: 'green', 'B+': 'blue', B: 'blue',
  C: 'orange', D: 'gold', F: 'red', 'N/A': 'default',
};

// Canonical max for labelling component context in results view
const COMPONENT_MAX = {
  'periodic test': 10,
  'notebook': 5,
  'sea': 5,
  'half yearly examination': 80,
  'yearly examination': 80,
};

const componentLabel = (examName, maxMarks) => {
  const n = (examName || '').toLowerCase().trim();
  const abbr = {
    'periodic test': 'PT',
    'notebook': 'NB',
    'sea': 'SEA',
    'half yearly examination': 'HY Exam',
    'yearly examination': 'Yearly',
  };
  return abbr[n] ? `${abbr[n]} /${COMPONENT_MAX[n] ?? maxMarks}` : examName;
};

const ExamResults = ({ initialExamId, onClearExamId }) => {
  const { message } = App.useApp();
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(initialExamId || undefined);
  const [resultData, setResultData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  // ── Filters ────────────────────────────────────────────────
  const [classFilter, setClassFilter] = useState(undefined);
  const [termFilter, setTermFilter] = useState(undefined);

  // Load exam list
  useEffect(() => {
    examAPI.getAll({ status: 'locked' }).then((r) => {
      // Results should typically show published or locked exams
      // We will fetch all published/locked, or just all since the backend usually handles it.
      // Actually, examAPI.getAll() handles it.
      const list = r?.data || [];
      setExams(Array.isArray(list) ? list : []);
    }).catch(() => { });
  }, []);

  const classOptions = React.useMemo(() => {
    const map = new Map();
    exams.forEach(e => {
      if (e.classId?._id && e.classId?.name) {
        map.set(e.classId._id, e.classId.name);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ label, value }));
  }, [exams]);

  const filteredExams = React.useMemo(() => {
    return exams.filter(e => {
      if (classFilter && e.classId?._id !== classFilter) return false;
      if (termFilter && e.term !== termFilter && !(termFilter === 'term1' && e.name === 'Half Yearly Examination') && !(termFilter === 'term2' && e.name === 'Yearly Examination')) {
        // Strict match on term, or implicit match for HY/YE if they lack the `term` field in legacy data
        if (e.term) return false; 
        if (termFilter === 'term1' && e.name?.toLowerCase().includes('half yearly')) return true;
        if (termFilter === 'term2' && e.name?.toLowerCase().includes('yearly') && !e.name?.toLowerCase().includes('half')) return true;
        return false;
      }
      return true;
    });
  }, [exams, classFilter, termFilter]);

  // If parent passes an initialExamId, set it
  useEffect(() => {
    if (initialExamId) {
      setSelectedExamId(initialExamId);
      onClearExamId?.();
    }
  }, [initialExamId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownloadMarksCard = (studentId) => {
    if (!studentId) return;
    window.open(examAPI.getMarksCardPdfUrl(studentId, { examId: selectedExamId }), '_blank', 'noopener');
  };

  const fetchResults = useCallback(async () => {
    if (!selectedExamId) { setResultData(null); return; }
    setLoading(true);
    try {
      const res = await examAPI.getExamResults(selectedExamId);
      setResultData(res?.data || res);
    } catch (err) {
      message.error(err.message || 'Failed to load results');
    } finally { setLoading(false); }
  }, [selectedExamId, message]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const exam = resultData?.exam;
  const stats = resultData?.stats;
  const students = resultData?.students || [];

  // Search filter
  const filtered = students.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.student?.name?.toLowerCase().includes(q) ||
      r.student?.rollNo?.toLowerCase().includes(q);
  });

  // ── Expandable: subject-wise marks with component context ─────────────────
  const expandedRowRender = (record) => (
    <Table
      dataSource={record.subjects}
      rowKey={(s) => String(s.subject?._id || Math.random())}
      pagination={false}
      size="small"
      bordered
      columns={[
        {
          title: 'Subject', width: 180,
          render: (_, s) => s.subject?.name || '—',
        },
        {
          title: 'Component', width: 140,
          render: (_, s) => {
            const label = componentLabel(s.examName || s.exam?.name, s.maxMarks);
            return <Tag color="blue" style={{ fontFamily: 'monospace' }}>{label}</Tag>;
          },
        },
        {
          title: 'Marks', width: 120, align: 'center',
          render: (_, s) => (
            <Text strong>
              {s.marksObtained}
              <Text type="secondary" style={{ fontWeight: 400 }}>/{s.maxMarks}</Text>
            </Text>
          ),
        },
        {
          title: '%', width: 80, align: 'center',
          render: (_, s) => `${s.percentage}%`,
        },
        {
          title: 'Grade', width: 80, align: 'center',
          render: (_, s) => <Tag color={GRADE_COLOR[s.grade] || 'default'}>{s.grade}</Tag>,
        },
        {
          title: 'Result', width: 90, align: 'center',
          render: (_, s) => s.passed
            ? <Tag color="green"><CheckCircleFilled /> Pass</Tag>
            : <Tag color="red"><CloseCircleFilled /> Fail</Tag>,
        },
      ]}
    />
  );


  // ── Main table columns ────────────────────────────────────
  const columns = [
    {
      title: 'Rank', key: 'rank', width: 60, align: 'center',
      render: (_, r) => r.rank
        ? r.rank === 1
          ? <span style={{ color: '#f59e0b', fontWeight: 700 }}>🥇 1</span>
          : <Text strong>#{r.rank}</Text>
        : <Text type="secondary">—</Text>,
    },
    { title: 'Roll No', key: 'roll', width: 90, render: (_, r) => r.student?.rollNo },
    {
      title: 'Student Name', key: 'name', width: 180,
      render: (_, r) => (
        <span>
          <Text strong>{r.student?.name}</Text>
          {r.rank === 1 && <TrophyOutlined style={{ color: '#f59e0b', marginLeft: 6 }} />}
        </span>
      ),
    },
    {
      title: 'Total', key: 'total', width: 110, align: 'center',
      render: (_, r) => r.result === 'Absent'
        ? <Text type="secondary">Absent</Text>
        : <Text strong>{r.totalObtained} / {r.totalMax}</Text>,
    },
    {
      title: '%', key: 'pct', width: 80, align: 'center',
      render: (_, r) => r.result === 'Absent'
        ? '—'
        : <Text strong style={{ color: r.percentage >= 60 ? '#16a34a' : '#dc2626' }}>{r.percentage}%</Text>,
    },
    {
      title: 'Grade', key: 'grade', width: 80, align: 'center',
      render: (_, r) => r.grade !== 'N/A'
        ? <Tag color={GRADE_COLOR[r.grade] || 'default'}>{r.grade}</Tag>
        : '—',
    },
    {
      title: 'Result', key: 'result', width: 100, align: 'center',
      render: (_, r) => {
        if (r.result === 'Absent') return <Tag color="default">Absent</Tag>;
        return r.result === 'Pass'
          ? <Tag color="green"><CheckCircleFilled /> Pass</Tag>
          : <Tag color="red"><CloseCircleFilled /> Fail</Tag>;
      },
    },
    {
      title: 'Marks Card', key: 'marksCard', width: 120, align: 'center',
      render: (_, r) => (
        <Button
          size="small"
          icon={<FilePdfOutlined />}
          onClick={() => handleDownloadMarksCard(r.student?._id)}
        >
          PDF
        </Button>
      ),
    },
  ];

  return (
    <>
      {/* Exam selector & Filters */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Select
          placeholder="Filter Class"
          style={{ width: 140 }}
          value={classFilter}
          onChange={(v) => { setClassFilter(v); setSelectedExamId(undefined); }}
          options={classOptions}
          allowClear
          showSearch
          optionFilterProp="label"
        />
        <Select
          placeholder="Filter Term"
          style={{ width: 120 }}
          value={termFilter}
          onChange={(v) => { setTermFilter(v); setSelectedExamId(undefined); }}
          options={[
            { label: 'Term 1', value: 'term1' },
            { label: 'Term 2', value: 'term2' },
          ]}
          allowClear
        />
        <Select
          placeholder="Select exam to view results"
          style={{ flex: 1, minWidth: 250 }}
          value={selectedExamId}
          onChange={(v) => { setSelectedExamId(v); setSearch(''); }}
          options={filteredExams.map((e) => ({
            label: `${e.examName || e.name} — ${e.classId?.name || ''}${e.term ? ` (${e.term})` : ''}`,
            value: e._id,
          }))}
          allowClear showSearch optionFilterProp="label"
          id="results-exam-select"
        />
        {selectedExamId && (
          <Input.Search
            placeholder="Search student…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            id="results-search"
            style={{ width: 220 }}
          />
        )}
      </div>

      {!selectedExamId ? (
        <Empty description="Select an exam to view results" style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Stats cards */}
          {stats && (
            <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <Statistic
                    title="Total Students"
                    value={stats.totalStudents}
                    prefix={<UserOutlined />}
                    valueStyle={{ color: '#1677ff' }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <Statistic
                    title="Pass %"
                    value={stats.passPercentage}
                    suffix="%"
                    precision={1}
                    prefix={<CheckCircleFilled />}
                    valueStyle={{ color: '#16a34a' }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" style={{ textAlign: 'center', borderRadius: 8 }}>
                  <Statistic
                    title="Average %"
                    value={stats.averagePercentage}
                    suffix="%"
                    precision={1}
                    prefix={<PercentageOutlined />}
                    valueStyle={{ color: '#7c3aed' }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card
                  size="small"
                  style={{ textAlign: 'center', borderRadius: 8, background: '#fef9c3', borderColor: '#fde047' }}
                >
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                    <TrophyOutlined style={{ color: '#f59e0b' }} /> Topper
                  </div>
                  {stats.topper ? (
                    <>
                      <Text strong style={{ display: 'block' }}>{stats.topper.name}</Text>
                      <Text style={{ color: '#f59e0b', fontWeight: 700 }}>{stats.topper.percentage}%</Text>
                    </>
                  ) : (
                    <Text type="secondary">—</Text>
                  )}
                </Card>
              </Col>
            </Row>
          )}

          {/* Summary bar */}
          {stats && (
            <div style={{
              background: '#f8fafc', border: '1px solid #e2e8f0',
              borderRadius: 8, padding: '8px 16px', marginBottom: 16,
              display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13,
            }}>
              <span>Marks entered: <Text strong>{stats.marksEntered}/{stats.totalStudents}</Text></span>
              <span><Tag color="green">Passed: {stats.passed}</Tag></span>
              <span><Tag color="red">Failed: {stats.failed}</Tag></span>
            </div>
          )}

          {/* Results table */}
          <Table
            columns={columns}
            dataSource={filtered}
            rowKey={(r) => String(r.student?._id)}
            loading={loading}
            expandable={{ expandedRowRender, rowExpandable: (r) => r.subjects?.length > 0 }}
            pagination={{ pageSize: 30, showTotal: (t) => `${t} students` }}
            scroll={{ x: 720 }}
            size="middle"
            bordered={false}
            rowClassName={(r) => r.result === 'Fail' ? 'row-fail' : ''}
            style={{ background: '#fff', borderRadius: 8 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No results yet" /> }}
          />
        </>
      )}
    </>
  );
};

export default ExamResults;
