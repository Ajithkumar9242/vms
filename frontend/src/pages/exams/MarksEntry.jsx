import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography, Select, Row, Col, Table, Button,
  InputNumber, Tag, Empty, App,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { examAPI, studentAPI } from '@/services/api';

const { Text } = Typography;

/**
 * MarksEntry — select exam → load students → subject-wise marks entry.
 * Handles the Exam.subjects schema: [{ subjectId: { _id, name, code }, maxMarks, passingMarks }]
 */
const MarksEntry = () => {
  const { message } = App.useApp();

  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(undefined);
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [marksMap, setMarksMap] = useState({}); // { `${studentId}_${subjectId}`: value }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Load exam list ───────────────────────────────────────
  useEffect(() => {
    examAPI.getAll()
      .then((res) => setExams(res.data || []))
      .catch(() => {});
  }, []);

  // ─── Load exam + students + existing marks ────────────────
  const loadExamData = useCallback(async () => {
    if (!selectedExamId) return;
    setLoading(true);
    try {
      const [examRes, marksRes] = await Promise.all([
        examAPI.getById(selectedExamId),
        examAPI.getMarks(selectedExamId),
      ]);
      const examData = examRes.data;
      setExam(examData);

      // Fetch students for this class
      const classId = examData.classId?._id || examData.classId;
      const stuRes = await studentAPI.getAll({ classId, limit: 200 });
      setStudents(stuRes.data || []);

      // Build marks map from existing entries
      const map = {};
      (marksRes.data?.marks || []).forEach((m) => {
        const sid = m.studentId?._id || m.studentId;
        const subId = m.subjectId?._id || m.subjectId;
        map[`${sid}_${subId}`] = m.marksObtained;
      });
      setMarksMap(map);
    } catch (err) {
      message.error(err.message || 'Failed to load exam data');
    } finally {
      setLoading(false);
    }
  }, [selectedExamId, message]);

  useEffect(() => {
    if (selectedExamId) loadExamData();
  }, [selectedExamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Update a mark ────────────────────────────────────────
  const updateMark = (studentId, subjectId, value) => {
    setMarksMap((prev) => ({ ...prev, [`${studentId}_${subjectId}`]: value }));
  };

  // ─── Save marks ───────────────────────────────────────────
  const handleSave = async () => {
    if (!exam || !students.length) return;
    setSaving(true);
    try {
      const marks = [];
      students.forEach((student) => {
        (exam.subjects || []).forEach((subjectEntry) => {
          // After populate: subjectEntry.subjectId = { _id, name, code }
          const subId = subjectEntry.subjectId?._id || subjectEntry.subjectId;
          const key = `${student._id}_${subId}`;
          const val = marksMap[key];
          if (val !== undefined && val !== null) {
            marks.push({
              studentId: student._id,
              subjectId: subId,
              marksObtained: val,
            });
          }
        });
      });

      if (!marks.length) {
        message.warning('No marks entered');
        setSaving(false);
        return;
      }

      const res = await examAPI.saveMarks(selectedExamId, { marks });
      const info = res.data;
      message.success(`Marks saved — ${info.total} entries (${info.saved} new, ${info.updated} updated)`);
    } catch (err) {
      message.error(err.message || 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  // ─── Dynamic columns ──────────────────────────────────────
  const subjectColumns = (exam?.subjects || []).map((subjectEntry) => {
    // After DB populate: subjectEntry = { subjectId: {_id, name, code}, maxMarks, passingMarks }
    const subDoc = subjectEntry.subjectId || {};
    const subId = subDoc._id || subjectEntry.subjectId;
    const maxM = subjectEntry.maxMarks || 100;
    const passingM = subjectEntry.passingMarks || 0;

    return {
      title: (
        <span>
          <Text strong>{subDoc.name || subDoc.code || 'Subject'}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 10 }}>
            Max: {maxM} | Pass: {passingM}
          </Text>
        </span>
      ),
      key: String(subId),
      width: 130,
      align: 'center',
      render: (_, record) => {
        const key = `${record._id}_${subId}`;
        const val = marksMap[key] ?? null;
        const isFail = val !== null && passingM > 0 && val < passingM;
        return (
          <InputNumber
            min={0}
            max={maxM}
            value={val}
            onChange={(v) => updateMark(record._id, String(subId), v)}
            size="small"
            style={{ width: 80, borderColor: isFail ? '#EF4444' : undefined }}
            placeholder="—"
          />
        );
      },
    };
  });

  const columns = [
    { title: '#', key: 'idx', width: 48, fixed: 'left', render: (_, __, i) => i + 1 },
    { title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 100, fixed: 'left' },
    {
      title: 'Student Name', dataIndex: 'name', key: 'name', width: 180, fixed: 'left',
      render: (text) => <Text strong>{text}</Text>,
    },
    ...subjectColumns,
    {
      title: 'Total',
      key: 'total',
      width: 90,
      align: 'center',
      render: (_, record) => {
        let total = 0;
        (exam?.subjects || []).forEach((se) => {
          const subId = se.subjectId?._id || se.subjectId;
          total += marksMap[`${record._id}_${subId}`] || 0;
        });
        const totalMax = (exam?.subjects || []).reduce((sum, se) => sum + (se.maxMarks || 0), 0);
        return (
          <Text strong style={{ color: total > 0 ? '#1D4ED8' : undefined }}>
            {total}/{totalMax}
          </Text>
        );
      },
    },
  ];

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={14} md={10}>
          <Select
            placeholder="Select exam"
            style={{ width: '100%' }}
            value={selectedExamId}
            onChange={(val) => setSelectedExamId(val)}
            options={exams.map((e) => ({
              label: `${e.name} — ${e.classId?.name || ''}`,
              value: e._id,
            }))}
            allowClear
            showSearch
            optionFilterProp="label"
            id="marks-exam-select"
          />
        </Col>
      </Row>

      {/* Exam info banner */}
      {exam && (
        <div style={{
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 8,
          padding: '10px 16px',
          marginBottom: 16,
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <span><Text type="secondary">Class:</Text> <Text strong>{exam.classId?.name}</Text></span>
          <span><Text type="secondary">Subjects:</Text>{' '}
            {(exam.subjects || []).map((se) => {
              const sub = se.subjectId || {};
              return (
                <Tag key={String(sub._id || se.subjectId)} color="blue" style={{ marginRight: 4 }}>
                  {sub.name || sub.code || '—'} ({se.maxMarks})
                </Tag>
              );
            })}
          </span>
        </div>
      )}

      {!selectedExamId ? (
        <Empty description="Select an exam to enter marks" style={{ marginTop: 40 }} />
      ) : (
        <>
          <Table
            columns={columns}
            dataSource={students}
            rowKey="_id"
            loading={loading}
            pagination={false}
            scroll={{ x: 330 + (exam?.subjects?.length || 0) * 130 }}
            size="middle"
            bordered
            style={{ background: '#FFF', borderRadius: 8 }}
            locale={{ emptyText: 'No students found in this class' }}
          />
          {students.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="large"
                onClick={handleSave}
                loading={saving}
                disabled={saving}
                id="save-marks-btn"
              >
                Save Marks
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default MarksEntry;
