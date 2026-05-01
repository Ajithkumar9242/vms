import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Select,
  DatePicker,
  Row,
  Col,
  Table,
  Button,
  Switch,
  Tag,
  Tabs,
  Card,
  Statistic,
  Empty,
  App,
} from 'antd';
import {
  SaveOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PercentageOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { studentAPI, schoolAPI, attendanceAPI } from '@/services/api';

const { Title, Text } = Typography;

const Attendance = () => {
  const { message } = App.useApp();

  // ─── Shared state ─────────────────────────────────────────
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  // ─── Mark tab state ───────────────────────────────────────
  const [markClassId, setMarkClassId] = useState(undefined);
  const [markSectionId, setMarkSectionId] = useState(undefined);
  const [markDate, setMarkDate] = useState(dayjs());
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingLoaded, setExistingLoaded] = useState(false);

  // ─── View tab state ──────────────────────────────────────
  const [viewClassId, setViewClassId] = useState(undefined);
  const [viewDateFrom, setViewDateFrom] = useState(null);
  const [viewDateTo, setViewDateTo] = useState(null);
  const [report, setReport] = useState([]);
  const [loadingReport, setLoadingReport] = useState(false);

  // ─── Load classes on mount ────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const res = await schoolAPI.getClasses({ limit: 50 });
        setClasses(res.data || []);
      } catch { /* non-critical */ }
    };
    load();
  }, []);

  // ─── Load sections when class changes (mark tab) ─────────
  useEffect(() => {
    if (!markClassId) { setSections([]); return; }
    const load = async () => {
      try {
        const res = await schoolAPI.getSections({ classId: markClassId, limit: 50 });
        setSections(res.data || []);
      } catch { /* non-critical */ }
    };
    load();
    setMarkSectionId(undefined);
  }, [markClassId]);

  // ═══════════════════════════════════════════════════════════
  //  MARK ATTENDANCE TAB
  // ═══════════════════════════════════════════════════════════

  const fetchStudents = useCallback(async () => {
    if (!markClassId || !markDate) return;
    setLoadingStudents(true);
    setExistingLoaded(false);
    try {
      // 1. Load students for this class/section
      const params = { classId: markClassId, limit: 200 };
      if (markSectionId) params.sectionId = markSectionId;
      const res = await studentAPI.getAll(params);
      const studs = res.data || [];
      setStudents(studs);

      // 2. Load existing attendance for this date (if any)
      const dateStr = markDate.format('YYYY-MM-DD');
      const attRes = await attendanceAPI.getByDate({
        classId: markClassId,
        sectionId: markSectionId || undefined,
        date: dateStr,
      });
      const existing = attRes.data || [];

      // Build map: studentId → status
      const map = {};
      studs.forEach((s) => {
        map[s._id] = 'present'; // default to present
      });
      existing.forEach((r) => {
        const sid = r.studentId?._id || r.studentId;
        map[sid] = r.status;
      });

      setAttendanceMap(map);
      setExistingLoaded(existing.length > 0);
    } catch (err) {
      message.error(err.message || 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  }, [markClassId, markSectionId, markDate, message]);

  // ─── Load students when filters change ────────────────────
  useEffect(() => {
    if (markClassId && markDate) fetchStudents();
  }, [markClassId, markSectionId, markDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Toggle attendance for a student ──────────────────────
  const toggleStatus = (studentId) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }));
  };

  // ─── Save attendance ──────────────────────────────────────
  const handleSave = async () => {
    if (!students.length) return;
    setSaving(true);
    try {
      const dateStr = markDate.format('YYYY-MM-DD');
      const records = students.map((s) => ({
        studentId: s._id,
        classId: markClassId,
        sectionId: markSectionId || null,
        date: dateStr,
        status: attendanceMap[s._id] || 'present',
      }));

      const res = await attendanceAPI.mark({ records });
      const info = res.data;
      message.success(
        `Attendance saved — ${info.total} students (${info.saved} new, ${info.updated} updated)`
      );
      setExistingLoaded(true);
    } catch (err) {
      message.error(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  // ─── Mark tab columns ─────────────────────────────────────
  const presentCount = Object.values(attendanceMap).filter((v) => v === 'present').length;
  const absentCount = students.length - presentCount;

  const markColumns = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_, __, i) => i + 1,
    },
    {
      title: 'Roll No',
      dataIndex: 'rollNo',
      key: 'rollNo',
      width: 110,
    },
    {
      title: 'Student Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Status',
      key: 'status',
      width: 140,
      render: (_, record) => {
        const isPresent = attendanceMap[record._id] === 'present';
        return (
          <Switch
            checked={isPresent}
            onChange={() => toggleStatus(record._id)}
            checkedChildren="Present"
            unCheckedChildren="Absent"
            style={{
              backgroundColor: isPresent ? '#22C55E' : '#EF4444',
            }}
          />
        );
      },
    },
    {
      title: '',
      key: 'tag',
      width: 80,
      render: (_, record) => {
        const status = attendanceMap[record._id];
        return status === 'present'
          ? <Tag color="green">P</Tag>
          : <Tag color="red">A</Tag>;
      },
    },
  ];

  // ═══════════════════════════════════════════════════════════
  //  VIEW ATTENDANCE TAB
  // ═══════════════════════════════════════════════════════════

  const fetchReport = useCallback(async () => {
    if (!viewClassId) return;
    setLoadingReport(true);
    try {
      const params = { classId: viewClassId };
      if (viewDateFrom) params.dateFrom = viewDateFrom.format('YYYY-MM-DD');
      if (viewDateTo) params.dateTo = viewDateTo.format('YYYY-MM-DD');

      const res = await attendanceAPI.getReport(params);
      setReport(res.data || []);
    } catch (err) {
      message.error(err.message || 'Failed to load report');
    } finally {
      setLoadingReport(false);
    }
  }, [viewClassId, viewDateFrom, viewDateTo, message]);

  useEffect(() => {
    if (viewClassId) fetchReport();
  }, [viewClassId, viewDateFrom, viewDateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const viewColumns = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_, __, i) => i + 1,
    },
    {
      title: 'Roll No',
      dataIndex: 'rollNo',
      key: 'rollNo',
      width: 110,
    },
    {
      title: 'Student Name',
      dataIndex: 'studentName',
      key: 'studentName',
      width: 200,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Present',
      dataIndex: 'totalPresent',
      key: 'totalPresent',
      width: 100,
      align: 'center',
      render: (val) => <Tag color="green">{val}</Tag>,
    },
    {
      title: 'Absent',
      dataIndex: 'totalAbsent',
      key: 'totalAbsent',
      width: 100,
      align: 'center',
      render: (val) => <Tag color="red">{val}</Tag>,
    },
    {
      title: 'Total Days',
      dataIndex: 'totalDays',
      key: 'totalDays',
      width: 100,
      align: 'center',
    },
    {
      title: 'Percentage',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 120,
      align: 'center',
      render: (val) => {
        let color = '#22C55E';
        if (val < 75) color = '#EF4444';
        else if (val < 85) color = '#F59E0B';
        return (
          <Text strong style={{ color }}>
            {val}%
          </Text>
        );
      },
    },
  ];

  // ─── Derived report stats ─────────────────────────────────
  const avgPercentage = report.length
    ? (report.reduce((s, r) => s + r.percentage, 0) / report.length).toFixed(1)
    : 0;

  // ═══════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════

  const tabItems = [
    {
      key: 'mark',
      label: 'Mark Attendance',
      children: (
        <>
          {/* Filters */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8} md={6}>
              <Select
                placeholder="Select class"
                style={{ width: '100%' }}
                value={markClassId}
                onChange={(val) => setMarkClassId(val)}
                options={classes.map((c) => ({ label: c.name, value: c._id }))}
                allowClear
                id="mark-class-select"
              />
            </Col>
            <Col xs={24} sm={8} md={6}>
              <Select
                placeholder="Select section"
                style={{ width: '100%' }}
                value={markSectionId}
                onChange={(val) => setMarkSectionId(val)}
                options={sections.map((s) => ({ label: s.name, value: s._id }))}
                allowClear
                disabled={!markClassId}
                id="mark-section-select"
              />
            </Col>
            <Col xs={24} sm={8} md={6}>
              <DatePicker
                style={{ width: '100%' }}
                value={markDate}
                onChange={(val) => setMarkDate(val)}
                disabledDate={(d) => d && d.isAfter(dayjs(), 'day')}
                format="DD-MM-YYYY"
                id="mark-date-picker"
              />
            </Col>
          </Row>

          {/* Stats bar */}
          {students.length > 0 && (
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={8}>
                <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#64748B' }}>Total</span>}
                    value={students.length}
                    prefix={<CalendarOutlined style={{ color: '#3B82F6' }} />}
                    styles={{ content: { fontSize: 20, fontWeight: 700, color: '#1B3A5C' } }}
                  />
                </Card>
              </Col>
              <Col xs={8}>
                <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#64748B' }}>Present</span>}
                    value={presentCount}
                    prefix={<CheckCircleOutlined style={{ color: '#22C55E' }} />}
                    styles={{ content: { fontSize: 20, fontWeight: 700, color: '#22C55E' } }}
                  />
                </Card>
              </Col>
              <Col xs={8}>
                <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#64748B' }}>Absent</span>}
                    value={absentCount}
                    prefix={<CloseCircleOutlined style={{ color: '#EF4444' }} />}
                    styles={{ content: { fontSize: 20, fontWeight: 700, color: '#EF4444' } }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* Table + Save */}
          {!markClassId ? (
            <Empty description="Select a class to load students" style={{ marginTop: 40 }} />
          ) : (
            <>
              <Table
                columns={markColumns}
                dataSource={students}
                rowKey="_id"
                loading={loadingStudents}
                pagination={false}
                scroll={{ x: 580 }}
                size="middle"
                bordered={false}
                style={{ background: '#FFF', borderRadius: 8 }}
                locale={{ emptyText: 'No students found for this class' }}
              />
              {students.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    size="large"
                    onClick={handleSave}
                    loading={saving}
                    disabled={saving}
                    id="save-attendance-btn"
                  >
                    {existingLoaded ? 'Update Attendance' : 'Save Attendance'}
                  </Button>
                  {existingLoaded && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ⚠ Attendance already exists for this date — saving will update it.
                    </Text>
                  )}
                </div>
              )}
            </>
          )}
        </>
      ),
    },
    {
      key: 'view',
      label: 'View Attendance',
      children: (
        <>
          {/* Filters */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8} md={6}>
              <Select
                placeholder="Select class"
                style={{ width: '100%' }}
                value={viewClassId}
                onChange={(val) => setViewClassId(val)}
                options={classes.map((c) => ({ label: c.name, value: c._id }))}
                allowClear
                id="view-class-select"
              />
            </Col>
            <Col xs={24} sm={8} md={6}>
              <DatePicker
                style={{ width: '100%' }}
                value={viewDateFrom}
                onChange={(val) => setViewDateFrom(val)}
                placeholder="From date"
                format="DD-MM-YYYY"
                id="view-date-from"
              />
            </Col>
            <Col xs={24} sm={8} md={6}>
              <DatePicker
                style={{ width: '100%' }}
                value={viewDateTo}
                onChange={(val) => setViewDateTo(val)}
                placeholder="To date"
                format="DD-MM-YYYY"
                id="view-date-to"
              />
            </Col>
          </Row>

          {/* Report stats */}
          {report.length > 0 && (
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={12} sm={8}>
                <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#64748B' }}>Students</span>}
                    value={report.length}
                    styles={{ content: { fontSize: 20, fontWeight: 700, color: '#1B3A5C' } }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8}>
                <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#64748B' }}>Avg Attendance</span>}
                    value={avgPercentage}
                    suffix="%"
                    prefix={<PercentageOutlined style={{ color: '#3B82F6' }} />}
                    styles={{
                      content: {
                        fontSize: 20,
                        fontWeight: 700,
                        color: avgPercentage >= 75 ? '#22C55E' : '#EF4444',
                      },
                    }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* Table */}
          {!viewClassId ? (
            <Empty description="Select a class to view attendance report" style={{ marginTop: 40 }} />
          ) : (
            <Table
              columns={viewColumns}
              dataSource={report}
              rowKey="_id"
              loading={loadingReport}
              pagination={{
                showSizeChanger: true,
                showTotal: (total) => `Total ${total} students`,
                pageSize: 20,
              }}
              scroll={{ x: 780 }}
              size="middle"
              bordered={false}
              style={{ background: '#FFF', borderRadius: 8 }}
              locale={{ emptyText: 'No attendance data found' }}
            />
          )}
        </>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <Title level={4} className="page-title" style={{ margin: 0 }}>
          Attendance Management
        </Title>
        <Text type="secondary">Mark and track student attendance</Text>
      </div>

      <Tabs
        defaultActiveKey="mark"
        items={tabItems}
        type="card"
        size="large"
        style={{ marginTop: 8 }}
      />
    </div>
  );
};

export default Attendance;
