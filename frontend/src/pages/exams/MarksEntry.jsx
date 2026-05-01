import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Select,
  Row,
  Col,
  Table,
  Button,
  InputNumber,
  Tag,
  Empty,
  App,
  Divider,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { examAPI, studentAPI } from '@/services/api';

const { Title, Text } = Typography;

/**
 * MarksEntry — select an exam, load students, enter marks per subject, bulk save.
 */
const MarksEntry = () => {
  const { message } = App.useApp();

  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(undefined);
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [marksMap, setMarksMap] = useState({}); // { `${studentId}_${subjectId}`: marks }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─── Load exams list ──────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await examAPI.getAll();
        setExams(res.data || []);
      } catch { /* non-critical */ }
    };
    load();
  }, []);

  // ─── Load exam detail + students + existing marks ─────────
  const loadExamData = useCallback(async () => {
    if (!selectedExamId) return;
    setLoading(true);
    try {
      // Fetch exam detail
      const examRes = await examAPI.getById(selectedExamId);
      const examData = examRes.data;
      setExam(examData);

      // Fetch students for this class
      const stuRes = await studentAPI.getAll({ classId: examData.classId._id, limit: 200 });
      setStudents(stuRes.data || []);

      // Fetch existing marks
      const marksRes = await examAPI.getMarks(selectedExamId);
      const existingMarks = marksRes.data?.marks || [];

      // Build marks map
      const map = {};
      existingMarks.forEach((m) => {
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

  // ─── Update marks ─────────────────────────────────────────
  const updateMark = (studentId, subjectId, value) => {
    setMarksMap((prev) => ({
      ...prev,
      [`${studentId}_${subjectId}`]: value,
    }));
  };

  // ─── Save marks ───────────────────────────────────────────
  const handleSave = async () => {
    if (!exam || !students.length) return;
    setSaving(true);
    try {
      const marks = [];
      students.forEach((student) => {
        exam.subjects.forEach((subject) => {
          const key = `${student._id}_${subject._id}`;
          const val = marksMap[key];
          if (val !== undefined && val !== null) {
            marks.push({
              studentId: student._id,
              subjectId: subject._id,
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

  // ─── Build dynamic columns based on exam subjects ─────────
  const columns = [
    {
      title: '#',
      key: 'index',
      width: 50,
      fixed: 'left',
      render: (_, __, i) => i + 1,
    },
    {
      title: 'Roll No',
      dataIndex: 'rollNo',
      key: 'rollNo',
      width: 100,
      fixed: 'left',
    },
    {
      title: 'Student Name',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      fixed: 'left',
      render: (text) => <Text strong>{text}</Text>,
    },
    // Subject columns — dynamic
    ...(exam?.subjects || []).map((subject) => ({
      title: (
        <span>
          {subject.name}
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>
            Max: {exam.maxMarks}
          </Text>
        </span>
      ),
      key: subject._id,
      width: 120,
      align: 'center',
      render: (_, record) => {
        const key = `${record._id}_${subject._id}`;
        return (
          <InputNumber
            min={0}
            max={exam.maxMarks}
            value={marksMap[key] ?? null}
            onChange={(val) => updateMark(record._id, subject._id, val)}
            size="small"
            style={{ width: 80 }}
            placeholder="—"
          />
        );
      },
    })),
    // Total column
    {
      title: 'Total',
      key: 'total',
      width: 90,
      align: 'center',
      render: (_, record) => {
        let total = 0;
        (exam?.subjects || []).forEach((s) => {
          total += marksMap[`${record._id}_${s._id}`] || 0;
        });
        return <Text strong>{total}</Text>;
      },
    },
  ];

  return (
    <>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
          <Select
            placeholder="Select exam"
            style={{ width: '100%' }}
            value={selectedExamId}
            onChange={(val) => setSelectedExamId(val)}
            options={exams.map((e) => ({
              label: `${e.name} — ${e.classId?.name || ''} (${e.academicYear})`,
              value: e._id,
            }))}
            allowClear
            showSearch
            optionFilterProp="label"
            id="marks-exam-select"
          />
        </Col>
      </Row>

      {exam && (
        <div
          style={{
            background: '#F0F5FF',
            border: '1px solid #D6E4FF',
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 16,
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <span><Text type="secondary">Class:</Text> <Text strong>{exam.classId?.name}</Text></span>
          <span><Text type="secondary">Max Marks:</Text> <Text strong>{exam.maxMarks}</Text></span>
          <span><Text type="secondary">Passing:</Text> <Text strong>{exam.passingMarks}</Text></span>
          <span><Text type="secondary">Subjects:</Text> {exam.subjects?.map((s) => <Tag key={s._id} color="blue">{s.code}</Tag>)}</span>
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
            scroll={{ x: 400 + (exam?.subjects?.length || 0) * 120 }}
            size="middle"
            bordered
            style={{ background: '#FFF', borderRadius: 8 }}
            locale={{ emptyText: 'No students found' }}
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
