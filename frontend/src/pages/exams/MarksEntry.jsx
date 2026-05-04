import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography, Select, Row, Col, Table, Button,
  InputNumber, Tag, Empty, App, Space, Alert,
} from 'antd';
import { SaveOutlined, InfoCircleOutlined, LockOutlined } from '@ant-design/icons';
import { examAPI, studentAPI } from '@/services/api';

const { Text } = Typography;

const getExamSubjects = (exam) => {
  if (!exam?.subjects?.length) return [];
  const first = exam.subjects[0];
  if (first?.subjectId) return exam.subjects.map((s) => s.subjectId).filter(Boolean);
  return exam.subjects;
};

const MarksEntry = () => {
  const { message } = App.useApp();
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(undefined);
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [marksMap, setMarksMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    examAPI.getAll().then((res) => {
      const list = res?.data || [];
      // Show published + locked exams
      setExams(Array.isArray(list) ? list.filter((e) => e.isPublished) : []);
    }).catch(() => {});
  }, []);

  const loadExamData = useCallback(async () => {
    if (!selectedExamId) return;
    setLoading(true); setMarksMap({});
    try {
      const [examRes, marksRes] = await Promise.all([
        examAPI.getById(selectedExamId),
        examAPI.getMarks(selectedExamId),
      ]);
      const examData = examRes?.data || examRes;
      setExam(examData);

      const classId = examData.classId?._id || examData.classId;
      const stuRes = await studentAPI.getAll({ classId, limit: 300 });
      const stuList = stuRes?.data?.students || stuRes?.data || [];
      setStudents(Array.isArray(stuList) ? stuList : []);

      const rawMarks = marksRes?.data?.marks || [];
      const map = {};
      rawMarks.forEach((m) => {
        const sid  = m.studentId?._id || m.studentId;
        const subId = m.subjectId?._id || m.subjectId;
        if (sid && subId) map[`${sid}_${subId}`] = m.marksObtained;
      });
      setMarksMap(map);
    } catch (err) {
      message.error(err.message || 'Failed to load exam data');
    } finally { setLoading(false); }
  }, [selectedExamId, message]);

  useEffect(() => {
    if (selectedExamId) loadExamData();
    else { setExam(null); setStudents([]); setMarksMap({}); }
  }, [selectedExamId, loadExamData]);

  const updateMark = (studentId, subjectId, value) =>
    setMarksMap((prev) => ({ ...prev, [`${studentId}_${subjectId}`]: value }));

  const handleSave = async () => {
    if (!exam || !students.length) return;
    setSaving(true);
    try {
      const examSubjects = getExamSubjects(exam);
      const marks = [];
      students.forEach((student) => {
        examSubjects.forEach((sub) => {
          const subId = sub._id || sub;
          const val = marksMap[`${student._id}_${subId}`];
          if (val !== undefined && val !== null) {
            marks.push({ studentId: student._id, subjectId: subId, marksObtained: val });
          }
        });
      });
      if (!marks.length) { message.warning('No marks entered'); setSaving(false); return; }
      const res = await examAPI.saveMarks(selectedExamId, { marks });
      const info = res?.data || res;
      message.success(`Saved ${info?.total ?? marks.length} marks`);
    } catch (err) {
      message.error(err.message || 'Failed to save marks');
    } finally { setSaving(false); }
  };

  const examSubjects = exam ? getExamSubjects(exam) : [];
  const maxM    = exam?.maxMarks ?? 100;
  const passing = exam?.passingMarks ?? 35;
  const isLocked = exam?.isLocked;

  const subjectCols = examSubjects.map((sub) => {
    const subId = sub._id || sub;
    return {
      title: (
        <span>
          <Text strong style={{ fontSize: 12 }}>{sub.name || sub.code || '—'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 10 }}>/{maxM} Pass:{passing}</Text>
        </span>
      ),
      key: String(subId), width: 120, align: 'center',
      render: (_, record) => {
        const key = `${record._id}_${subId}`;
        const val = marksMap[key] ?? null;
        const isFail = val !== null && passing > 0 && val < passing;
        return (
          <InputNumber
            min={0} max={maxM} value={val} size="small"
            onChange={(v) => updateMark(record._id, String(subId), v)}
            style={{ width: 72, borderColor: isFail ? '#ef4444' : undefined }}
            status={isFail ? 'error' : undefined}
            placeholder="—"
            disabled={isLocked}
          />
        );
      },
    };
  });

  const columns = [
    { title: '#', key: 'idx', width: 42, fixed: 'left', render: (_, __, i) => i + 1 },
    { title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 90, fixed: 'left' },
    {
      title: 'Student', dataIndex: 'name', key: 'name', width: 160, fixed: 'left',
      render: (text) => <Text strong>{text}</Text>,
    },
    ...subjectCols,
    {
      title: 'Total / %', key: 'total', width: 100, align: 'center',
      render: (_, record) => {
        let tot = 0;
        examSubjects.forEach((sub) => { tot += marksMap[`${record._id}_${sub._id || sub}`] || 0; });
        const totMax = examSubjects.length * maxM;
        const pct = totMax > 0 ? Math.round((tot / totMax) * 100) : 0;
        return tot > 0 ? (
          <span>
            <Text strong style={{ color: '#1d4ed8' }}>{tot}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}> / {totMax}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>{pct}%</Text>
          </span>
        ) : <Text type="secondary">—</Text>;
      },
    },
  ];

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={14} md={10}>
          <Select
            placeholder="Select a published exam"
            style={{ width: '100%' }}
            value={selectedExamId}
            onChange={setSelectedExamId}
            options={exams.map((e) => ({
              label: `${e.examName || e.name} — ${e.classId?.name || ''}`,
              value: e._id,
            }))}
            allowClear showSearch optionFilterProp="label"
            id="marks-exam-select"
          />
        </Col>
      </Row>

      {isLocked && (
        <Alert
          type="warning" showIcon
          icon={<LockOutlined />}
          message="This exam is locked. Marks are read-only."
          style={{ marginBottom: 16 }}
        />
      )}

      {exam && (
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
          padding: '10px 16px', marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap',
        }}>
          <span><Text type="secondary">Class: </Text><Text strong>{exam.classId?.name}</Text></span>
          <span><Text type="secondary">Max: </Text><Text strong>{maxM}</Text></span>
          <span><Text type="secondary">Pass: </Text><Text strong>{passing}</Text></span>
          <span><Text type="secondary">Subjects: </Text><Text strong>{examSubjects.length}</Text></span>
          <span><Text type="secondary">Students: </Text><Text strong>{students.length}</Text></span>
        </div>
      )}

      {!selectedExamId ? (
        <Empty description="Select a published exam to enter marks" style={{ marginTop: 40 }} />
      ) : examSubjects.length === 0 && !loading ? (
        <Empty
          description={<span><InfoCircleOutlined style={{ marginRight: 6 }} />No subjects in this exam</span>}
          style={{ marginTop: 40 }}
        />
      ) : (
        <>
          <Table
            columns={columns} dataSource={students} rowKey="_id" loading={loading}
            pagination={false}
            scroll={{ x: 300 + examSubjects.length * 120 }}
            size="middle" bordered
            style={{ background: '#fff', borderRadius: 8 }}
            locale={{ emptyText: 'No students in this class' }}
          />
          {students.length > 0 && !isLocked && (
            <Space style={{ marginTop: 16 }}>
              <Button type="primary" icon={<SaveOutlined />} size="large"
                onClick={handleSave} loading={saving} id="save-marks-btn">
                Save Marks
              </Button>
              <Text type="secondary">{students.length} students · {examSubjects.length} subjects</Text>
            </Space>
          )}
        </>
      )}
    </>
  );
};

export default MarksEntry;
