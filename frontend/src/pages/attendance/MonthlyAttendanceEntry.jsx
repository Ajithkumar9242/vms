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
  const [monthDay, setMonthDay]         = useState(dayjs());        // dayjs obj for picker
  const [monthKey, setMonthKey]         = useState(dayjs().format('YYYY-MM'));
  const [totalConducted, setTotalConducted] = useState(null);
  const [rows, setRows]                 = useState([]);
  const [loading, setLoading]           = useState(false);
  const [saving, setSaving]             = useState(false);

  // Load classes once
  useEffect(() => {
    schoolAPI.getClasses({ limit: 50 })
      .then(res => setClasses(res.data || []))
      .catch(() => {});
  }, []);

  // Fetch students + existing monthly entry
  const fetchEntry = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      // Students
      const studsRes = await studentAPI.getAll({ classId, limit: 200 });
      const students = studsRes.data?.students || studsRes.data || [];

      // Existing monthly entry
      const entryRes = await attendanceAPI.getMonthlyClassEntry(classId, { monthKey });
      const entry = entryRes?.data || null;

      // Build existing map: studentId → attendedClasses
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
      message.success(`✅ Monthly attendance saved for ${dayjs(monthKey, 'YYYY-MM').format('MMMM YYYY')}`);
    } catch (e) {
      message.error(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: '#', key: 'index', width: 44, render: (_, __, i) => i + 1 },
    { title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 90 },
    {
      title: 'Student Name', dataIndex: 'name', key: 'name',
      render: t => <Text strong>{t}</Text>,
    },
    {
      title: `Classes Attended${totalConducted !== null ? ` (max ${totalConducted})` : ''}`,
      key: 'attended', width: 200,
      render: (_, record) => (
        <InputNumber
          min={0}
          max={totalConducted ?? 9999}
          value={record.attendedClasses}
          onChange={val => handleRowChange(record.studentId, val)}
          style={{ width: 110 }}
          status={record.attendedClasses > (totalConducted ?? Infinity) ? 'error' : undefined}
          id={`attended-${record.studentId}`}
        />
      ),
    },
    {
      title: '%', key: 'pct', width: 80, align: 'center',
      render: (_, record) => {
        const pct = totalConducted > 0
          ? Math.round((record.attendedClasses / totalConducted) * 100) : 0;
        const color = pct >= 75 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';
        return <Text style={{ color, fontWeight: 700 }}>{totalConducted > 0 ? `${pct}%` : '—'}</Text>;
      },
    },
  ];

  return (
    <>
      {/* Filter row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
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
        <Col xs={24} sm={8} md={5}>
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
            format="MMMM YYYY"
            allowClear={false}
            id="monthly-entry-month-picker"
          />
        </Col>
        <Col xs={24} sm={8} md={7}>
          <InputNumber
            placeholder="Total classes conducted this month"
            min={0}
            value={totalConducted}
            onChange={val => setTotalConducted(val ?? 0)}
            style={{ width: '100%' }}
            addonBefore="Conducted"
            id="monthly-total-conducted"
          />
        </Col>
      </Row>

      {/* Info strip */}
      {classId && (
        <div style={{
          background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: 8, padding: '6px 14px', marginBottom: 12,
          fontSize: 12, color: '#1E40AF',
        }}>
          📅 <strong>{dayjs(monthKey, 'YYYY-MM').format('MMMM YYYY')}</strong>
          &nbsp;·&nbsp; Conducted: <strong>{totalConducted ?? '—'}</strong>
          &nbsp;·&nbsp; Showing previously saved values where available.
        </div>
      )}

      {!classId ? (
        <Empty description="Select a class to begin entering monthly attendance" style={{ marginTop: 48 }} />
      ) : (
        <>
          <Table
            columns={columns}
            dataSource={rows}
            rowKey="studentId"
            loading={loading}
            pagination={false}
            scroll={{ x: 560 }}
            size="middle"
            bordered={false}
            style={{ background: '#FFF', borderRadius: 8 }}
            locale={{ emptyText: 'No students found for this class' }}
          />
          {rows.length > 0 && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 14 }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="large"
                onClick={handleSave}
                loading={saving}
                disabled={saving || totalConducted === null}
                id="save-monthly-attendance-btn"
              >
                Save Monthly Attendance
              </Button>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Saving will update existing data for this month if it was already entered.
              </Text>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default MonthlyAttendanceEntry;
