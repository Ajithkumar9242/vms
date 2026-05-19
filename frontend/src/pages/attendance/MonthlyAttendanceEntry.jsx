import React, { useState, useEffect, useCallback } from 'react';
import {
  Select, DatePicker, InputNumber, Table, Button,
  Typography, Row, Col, App, Empty,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { studentAPI, schoolAPI, attendanceAPI } from '@/services/api';

const { Text } = Typography;

const MonthlyAttendanceEntry = () => {
  const { message } = App.useApp();

  const [classes, setClasses]           = useState([]);
  const [classId, setClassId]           = useState(undefined);
  const [monthDay, setMonthDay]         = useState(dayjs());
  const [monthKey, setMonthKey]         = useState(dayjs().format('YYYY-MM'));
  const [totalConducted, setTotalConducted] = useState(null);
  const [rows, setRows]                 = useState([]);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    schoolAPI.getClasses({ limit: 50 })
      .then(res => setClasses(res.data || []))
      .catch(() => {});
  }, []);

  const fetchEntry = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const studsRes = await studentAPI.getAll({ classId, limit: 200 });
      const students = studsRes.data?.students || studsRes.data || [];

      const entryRes = await attendanceAPI.getMonthlyClassEntry(classId, { monthKey });
      const entry = entryRes?.data || null;

      const existingMap = {};
      if (entry?.rows) {
        for (const r of entry.rows) {
          const sid = r.studentId?.toString();
          if (sid) existingMap[sid] = r.attendedClasses;
        }
      }

      setTotalConducted(entry?.totalClassesConducted ?? null);
      setRows(students.map(s => ({
        studentId: s._id,
        name: s.name,
        rollNo: s.rollNo,
        attendedClasses: existingMap[s._id?.toString()] ?? 0,
      })));
    } catch (e) {
      message.error(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [classId, monthKey, message]);

  useEffect(() => {
    if (classId) fetchEntry();
  }, [classId, monthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRowChange = (studentId, value) => {
    setRows(prev => prev.map(r =>
      r.studentId.toString() === studentId.toString()
        ? { ...r, attendedClasses: value ?? 0 }
        : r
    ));
  };

  const handleSave = async () => {
    if (!classId) { message.error('Select a class first'); return; }
    if (totalConducted === null || totalConducted === undefined || totalConducted < 0) {
      message.error('Enter total classes conducted this month'); return;
    }
    for (const r of rows) {
      if ((r.attendedClasses || 0) > totalConducted) {
        message.error(`${r.name}: attended (${r.attendedClasses}) exceeds conducted (${totalConducted})`);
        return;
      }
    }
    setSaving(true);
    try {
      await attendanceAPI.upsertMonthly({
        classId,
        monthKey,
        totalClassesConducted: Number(totalConducted),
        rows: rows.map(r => ({ studentId: r.studentId, attendedClasses: r.attendedClasses || 0 })),
      });
      message.success(`✅ Saved for ${dayjs(monthKey, 'YYYY-MM').format('MMMM YYYY')}`);
    } catch (e) {
      message.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: '#', key: 'index', width: 40, render: (_, __, i) => i + 1 },
    { title: 'Roll', dataIndex: 'rollNo', key: 'rollNo', width: 70 },
    {
      title: 'Student Name', dataIndex: 'name', key: 'name',
      render: t => <Text strong style={{ fontSize: 13 }}>{t}</Text>,
    },
    {
      title: `Attended${totalConducted !== null ? ` / ${totalConducted}` : ''}`,
      key: 'attended', width: 140,
      render: (_, record) => (
        <InputNumber
          min={0}
          max={totalConducted ?? 9999}
          value={record.attendedClasses}
          onChange={val => handleRowChange(record.studentId, val)}
          style={{ width: 90 }}
          status={record.attendedClasses > (totalConducted ?? Infinity) ? 'error' : undefined}
          id={`attended-${record.studentId}`}
          size="small"
        />
      ),
    },
    {
      title: '%', key: 'pct', width: 64, align: 'center',
      render: (_, record) => {
        const pct = totalConducted > 0
          ? Math.round((record.attendedClasses / totalConducted) * 100) : 0;
        const color = pct >= 75 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';
        return <Text style={{ color, fontWeight: 700, fontSize: 12 }}>{totalConducted > 0 ? `${pct}%` : '—'}</Text>;
      },
    },
  ];

  return (
    <div className="faculty-module">

      {/* ── Controls ── */}
      <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
        <Col xs={24} sm={8}>
          <Select
            placeholder="Select class"
            style={{ width: '100%' }}
            value={classId}
            onChange={val => setClassId(val)}
            options={classes.map(c => ({ label: c.name, value: c._id }))}
            allowClear
            id="monthly-entry-class-select"
          />
        </Col>
        <Col xs={24} sm={8}>
          <DatePicker
            picker="month"
            style={{ width: '100%' }}
            value={monthDay}
            onChange={(d) => {
              if (!d) return;
              setMonthDay(d);
              setMonthKey(d.format('YYYY-MM'));
            }}
            disabledDate={d => d && d.isAfter(dayjs(), 'month')}
            format="MMM YYYY"
            allowClear={false}
            id="monthly-entry-month-picker"
          />
        </Col>
        <Col xs={24} sm={8}>
          <InputNumber
            placeholder="Classes conducted"
            min={0}
            value={totalConducted}
            onChange={val => setTotalConducted(val ?? 0)}
            style={{ width: '100%' }}
            addonBefore="Total"
            id="monthly-total-conducted"
          />
        </Col>
      </Row>

      {/* ── Info strip ── */}
      {classId && (
        <div className="faculty-info-strip">
          📅 <strong>{dayjs(monthKey, 'YYYY-MM').format('MMMM YYYY')}</strong>
          &nbsp;·&nbsp; Conducted: <strong>{totalConducted ?? '—'}</strong>
          &nbsp;·&nbsp; Previously saved data loaded automatically.
        </div>
      )}

      {/* ── Content ── */}
      {!classId ? (
        <Empty description="Select a class to begin entering monthly attendance" style={{ marginTop: 48 }} />
      ) : (
        <>
          <div className="faculty-table-wrap">
            <Table
              columns={columns}
              dataSource={rows}
              rowKey="studentId"
              loading={loading}
              pagination={false}
              scroll={{ x: 420 }}
              size="small"
              bordered={false}
              locale={{ emptyText: 'No students found for this class' }}
            />
          </div>
          {rows.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="large"
                onClick={handleSave}
                loading={saving}
                disabled={saving || totalConducted === null}
                id="save-monthly-attendance-btn"
                block
              >
                Save Monthly Attendance
              </Button>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6, textAlign: 'center' }}>
                Updates existing data for this month if already saved.
              </Text>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MonthlyAttendanceEntry;
