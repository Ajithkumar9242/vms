import React, { useState, useCallback } from 'react';
import {
  Typography,
  Select,
  Row,
  Col,
  Table,
  Tag,
  Card,
  Statistic,
  Empty,
  App,
  Collapse,
} from 'antd';
import {
  TrophyOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from '@ant-design/icons';
import { examAPI, studentAPI, schoolAPI } from '@/services/api';
import { useEffect } from 'react';

const { Title, Text } = Typography;

/**
 * StudentResults — select a student (from class filter), view all exam results.
 */
const StudentResults = () => {
  const { message } = App.useApp();

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(undefined);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(undefined);
  const [resultData, setResultData] = useState(null);
  const [loading, setLoading] = useState(false);

  // ─── Load classes ─────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await schoolAPI.getClasses({ limit: 50 });
        setClasses(res.data || []);
      } catch { /* */ }
    };
    load();
  }, []);

  // ─── Load students on class change ────────────────────────
  useEffect(() => {
    if (!classId) { setStudents([]); setSelectedStudentId(undefined); return; }
    const load = async () => {
      try {
        const res = await studentAPI.getAll({ classId, limit: 200 });
        setStudents(res.data || []);
      } catch { /* */ }
    };
    load();
    setSelectedStudentId(undefined);
    setResultData(null);
  }, [classId]);

  // ─── Load results on student change ───────────────────────
  const fetchResults = useCallback(async () => {
    if (!selectedStudentId) { setResultData(null); return; }
    setLoading(true);
    try {
      const res = await examAPI.getStudentResults(selectedStudentId);
      setResultData(res.data);
    } catch (err) {
      message.error(err.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  }, [selectedStudentId, message]);

  useEffect(() => {
    fetchResults();
  }, [selectedStudentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = resultData?.results || [];
  const student = resultData?.student;

  return (
    <>
      {/* Filters */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="Select class"
            style={{ width: '100%' }}
            value={classId}
            onChange={(val) => setClassId(val)}
            options={classes.map((c) => ({ label: c.name, value: c._id }))}
            allowClear
            id="result-class-select"
          />
        </Col>
        <Col xs={24} sm={10} md={8}>
          <Select
            placeholder="Select student"
            style={{ width: '100%' }}
            value={selectedStudentId}
            onChange={(val) => setSelectedStudentId(val)}
            options={students.map((s) => ({ label: `${s.rollNo} — ${s.name}`, value: s._id }))}
            allowClear
            showSearch
            optionFilterProp="label"
            disabled={!classId}
            id="result-student-select"
          />
        </Col>
      </Row>

      {!selectedStudentId ? (
        <Empty description="Select a class and student to view results" style={{ marginTop: 40 }} />
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>Loading...</div>
      ) : results.length === 0 ? (
        <Empty description="No results found for this student" style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* Student info */}
          {student && (
            <div
              style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                padding: '14px 20px',
                marginBottom: 20,
                display: 'flex',
                gap: 32,
                flexWrap: 'wrap',
              }}
            >
              <span><Text type="secondary">Name:</Text> <Text strong>{student.name}</Text></span>
              <span><Text type="secondary">Roll No:</Text> <Text strong>{student.rollNo}</Text></span>
              <span><Text type="secondary">Class:</Text> <Text strong>{student.classId?.name}</Text></span>
            </div>
          )}

          {/* Results cards */}
          {results.map((r, idx) => (
            <Card
              key={idx}
              size="small"
              style={{
                marginBottom: 16,
                borderRadius: 10,
                border: r.result === 'Pass' ? '1px solid #BBF7D0' : '1px solid #FECACA',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <div>
                  <Text strong style={{ fontSize: 16 }}>{r.exam.name}</Text>
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    {r.exam.academicYear} — {r.exam.className}
                  </Text>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {r.grade && (
                    <Tag
                      color={{
                        'A+': 'green', A: 'green', 'B+': 'blue', B: 'blue',
                        C: 'orange', D: 'orange', F: 'red',
                      }[r.grade] || 'default'}
                      style={{ fontSize: 14, padding: '2px 10px', fontWeight: 600 }}
                    >
                      {r.grade}
                    </Tag>
                  )}
                  <Tag color={r.result === 'Pass' ? 'green' : 'red'} style={{ fontSize: 13, padding: '2px 12px' }}>
                    {r.result === 'Pass' ? <CheckCircleFilled /> : <CloseCircleFilled />}{' '}
                    {r.result}
                  </Tag>
                  <Text strong style={{ fontSize: 18, color: r.percentage >= 60 ? '#22C55E' : '#EF4444' }}>
                    {r.percentage}%
                  </Text>
                </div>
              </div>

              {/* Subject table */}
              <Table
                dataSource={r.subjects}
                rowKey={(s) => s.subject?._id || Math.random()}
                pagination={false}
                size="small"
                bordered
                columns={[
                  {
                    title: 'Subject',
                    render: (_, s) => s.subject?.name || '—',
                    width: 180,
                  },
                  {
                    title: 'Marks',
                    render: (_, s) => `${s.marksObtained} / ${s.maxMarks}`,
                    width: 120,
                    align: 'center',
                  },
                  {
                    title: 'Grade',
                    dataIndex: 'grade',
                    width: 80,
                    align: 'center',
                    render: (g) => {
                      const colors = { 'A+': 'green', A: 'green', 'B+': 'blue', B: 'blue', C: 'orange', D: 'orange', F: 'red' };
                      return <Tag color={colors[g] || 'default'}>{g}</Tag>;
                    },
                  },
                ]}
              />

              {/* Totals */}
              <div style={{ marginTop: 8, textAlign: 'right' }}>
                <Text type="secondary">Total:</Text>{' '}
                <Text strong>{r.totalObtained} / {r.totalMax}</Text>
              </div>
            </Card>
          ))}
        </>
      )}
    </>
  );
};

export default StudentResults;
