import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography, Select, DatePicker, Row, Col, Table, Button,
  Switch, Tag, Tabs, Card, Statistic, Empty, App, Modal, Divider, Badge,
} from 'antd';
import {
  SaveOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PercentageOutlined, CalendarOutlined, LockOutlined, UnlockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { studentAPI, schoolAPI, attendanceAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import MonthlyAttendanceEntry from './MonthlyAttendanceEntry';
import MonthlyAttendanceReport from './MonthlyAttendanceReport';

const { Title, Text } = Typography;

const Attendance = () => {

  const { message, modal } = App.useApp();
  const { user: authUser } = useAuthStore();
  const isAdmin = authUser?.role === 'admin' || authUser?.role === 'super_admin';
  useEffect(() => {
    if (!authUser) {
      console.warn("❌ No user in store");
    } else {
      console.log("✅ Logged in as:", authUser.role);
    }
  }, [authUser]);
  // ─── Shared ───────────────────────────────────────────────
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);
  const [sessions, setSessions] = useState(['Morning']);

  // ─── Mark tab ─────────────────────────────────────────────
  const [markClassId, setMarkClassId] = useState(undefined);
  const [markSectionId, setMarkSectionId] = useState(undefined);
  const [markDate, setMarkDate] = useState(dayjs());
  const [markSession, setMarkSession] = useState('Morning');
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [isLocked, setIsLocked] = useState(false); // whether current view is locked
  const [existingLoaded, setExistingLoaded] = useState(false);

  // ─── Report tab ───────────────────────────────────────────
  const [viewClassId, setViewClassId] = useState(undefined);
  const [viewDateFrom, setViewDateFrom] = useState(null);
  const [viewDateTo, setViewDateTo] = useState(null);
  const [viewSession, setViewSession] = useState(undefined);
  const [report, setReport] = useState([]);
  const [reportStats, setReportStats] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // ─── Load classes + sessions on mount ────────────────────
  useEffect(() => {
    schoolAPI.getClasses({ limit: 50 })
      .then((res) => setClasses(res.data || []))
      .catch(() => { });
    attendanceAPI.getSessions()
      .then((res) => {
        const s = res.data || ['Morning'];

        const normalized = s.map((x) =>
          typeof x === 'string' ? x : x.name
        );

        setSessions(normalized);
        setMarkSession(normalized[0]);
      })
      .catch(() => { });
  }, []);

  // ─── Load sections when class changes ────────────────────
  useEffect(() => {
    if (!markClassId) { setSections([]); return; }
    schoolAPI.getSections({ classId: markClassId, limit: 50 })
      .then((res) => setSections(res.data || []))
      .catch(() => { });
    setMarkSectionId(undefined);
  }, [markClassId]);

  // ═══════════════════════════════════════════════════════════
  //  MARK ATTENDANCE TAB
  // ═══════════════════════════════════════════════════════════

  const fetchStudents = useCallback(async () => {
    if (!markClassId || !markDate) return;
    setLoadingStudents(true);
    setExistingLoaded(false);
    setIsLocked(false);
    try {
      const params = { classId: markClassId, limit: 200 };
      if (markSectionId) params.sectionId = markSectionId;
      const res = await studentAPI.getAll(params);
      const studs = res.data || [];
      setStudents(studs);

      // Load existing attendance for this date + session
      const dateStr = markDate.format('YYYY-MM-DD');
      const attRes = await attendanceAPI.getByDate({
        classId: markClassId,
        sectionId: markSectionId || undefined,
        date: dateStr,
        session: typeof markSession === 'string'
          ? markSession
          : markSession?.name,
      });
      const existing = attRes.data || [];

      // Build map: studentId → status, default present
      const map = {};
      studs.forEach((s) => { map[s._id] = 'present'; });
      existing.forEach((r) => {
        const sid = r.studentId?._id || r.studentId;
        map[sid] = r.status;
      });
      setAttendanceMap(map);
      setExistingLoaded(existing.length > 0);

      // Check if locked
      const locked = existing.some((r) => r.isLocked);
      setIsLocked(locked);
    } catch (err) {
      message.error(err.message || 'Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  }, [markClassId, markSectionId, markDate, markSession, message]);

  useEffect(() => {
    if (markClassId && markDate) fetchStudents();
  }, [markClassId, markSectionId, markDate, markSession]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Toggle individual student ────────────────────────────
  const toggleStatus = (studentId) => {
    if (isLocked && !isAdmin) { message.warning('Attendance is locked. Contact admin to override.'); return; }
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === 'present' ? 'absent' : 'present',
    }));
  };

  // ─── Bulk actions ─────────────────────────────────────────
  const markAllPresent = () => {
    if (isLocked && !isAdmin) { message.warning('Attendance is locked.'); return; }
    const map = {};
    students.forEach((s) => { map[s._id] = 'present'; });
    setAttendanceMap(map);
  };


  const markAllAbsent = () => {
    if (isLocked && !isAdmin) { message.warning('Attendance is locked.'); return; }
    const map = {};
    students.forEach((s) => { map[s._id] = 'absent'; });
    setAttendanceMap(map);
  };


  // ─── Save attendance ──────────────────────────────────────
  const handleSave = async () => {
    if (!students.length) return;
    // Admin can always override locked attendance; faculty cannot
    if (isLocked && !isAdmin) { message.error('Cannot save — attendance is locked.'); return; }
    setSaving(true);
    try {
      const dateStr = markDate.format('YYYY-MM-DD');
      const records = students.map((s) => ({
        studentId: s._id,
        classId: markClassId,
        sectionId: markSectionId || null,
        date: dateStr,
        session: typeof markSession === 'string'
          ? markSession
          : markSession?.name,
        status: attendanceMap[s._id] || 'present',
      }));

      const res = await attendanceAPI.mark({ records });
      const info = res.data;
      message.success(`Attendance saved — ${info.total} students (${info.saved} new, ${info.updated} updated)`);
      setExistingLoaded(true);
    } catch (err) {
      message.error(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  // ─── Lock confirmation + submit ───────────────────────────
  const handleLock = () => {
    const presentCount = Object.values(attendanceMap).filter((v) => v === 'present').length;
    const absentCount = students.length - presentCount;

    modal.confirm({
      title: 'Lock Attendance',
      icon: <LockOutlined style={{ color: '#F59E0B' }} />,
      content: (
        <div style={{ marginTop: 12 }}>
          <p>Once locked, faculty cannot edit this attendance. Only admin can override.</p>
          <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
            <div><Text type="secondary">Total Students:</Text> <Text strong>{students.length}</Text></div>
            <div><Text type="secondary">Present:</Text> <Text strong style={{ color: '#22C55E' }}>{presentCount}</Text></div>
            <div><Text type="secondary">Absent:</Text> <Text strong style={{ color: '#EF4444' }}>{absentCount}</Text></div>
            <div><Text type="secondary">Session:</Text> <Text strong>{markSession}</Text></div>
            <div><Text type="secondary">Date:</Text> <Text strong>{markDate?.format('DD MMM YYYY')}</Text></div>
          </div>
        </div>
      ),
      okText: 'Lock Attendance',
      okButtonProps: { danger: false, style: { background: '#F59E0B', borderColor: '#F59E0B' } },
      cancelText: 'Cancel',
      onOk: async () => {
        setLocking(true);
        try {
          await attendanceAPI.lock({
            classId: markClassId,
            date: markDate.format('YYYY-MM-DD'),
            session: typeof markSession === 'string'
              ? markSession
              : markSession?.name,
          });
          message.success('Attendance locked successfully');
          setIsLocked(true);
        } catch (err) {
          message.error(err.message || 'Failed to lock attendance');
        } finally {
          setLocking(false);
        }
      },
    });
  };

  // ─── Derived counts ───────────────────────────────────────
  const presentCount = Object.values(attendanceMap).filter((v) => v === 'present').length;
  const absentCount = students.length - presentCount;

  // ─── Mark tab columns ─────────────────────────────────────
  const markColumns = [
    { title: '#', key: 'index', width: 48, render: (_, __, i) => i + 1 },
    { title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 100 },
    {
      title: 'Student Name', dataIndex: 'name', key: 'name', width: 200,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      render: (_, record) => {
        const isPresent = attendanceMap[record._id] === 'present';
        return (
          <Switch
            checked={isPresent}
            onChange={() => toggleStatus(record._id)}
            checkedChildren="Present"
            unCheckedChildren="Absent"
            disabled={isLocked && !isAdmin}
            style={{ backgroundColor: isPresent ? '#22C55E' : '#EF4444' }}
          />
        );
      },
    },
    {
      title: '',
      key: 'tag',
      width: 60,
      render: (_, record) => {
        const status = attendanceMap[record._id];
        return status === 'present'
          ? <Tag color="green">P</Tag>
          : <Tag color="red">A</Tag>;
      },
    },
  ];

  // ═══════════════════════════════════════════════════════════
  //  REPORT TAB
  // ═══════════════════════════════════════════════════════════

  const fetchReport = useCallback(async () => {
    if (!viewClassId) return;
    setLoadingReport(true);
    try {
      const params = { classId: viewClassId };
      if (viewDateFrom) params.dateFrom = viewDateFrom.format('YYYY-MM-DD');
      if (viewDateTo) params.dateTo = viewDateTo.format('YYYY-MM-DD');
      if (viewSession) params.session = viewSession;

      const res = await attendanceAPI.getReport(params);
      // New service returns { report, stats }
      const data = res.data;
      if (data && data.report) {
        setReport(data.report);
        setReportStats(data.stats);
      } else {
        // Backward compat if array returned
        setReport(Array.isArray(data) ? data : []);
        setReportStats(null);
      }
    } catch (err) {
      message.error(err.message || 'Failed to load report');
    } finally {
      setLoadingReport(false);
    }
  }, [viewClassId, viewDateFrom, viewDateTo, viewSession, message]);

  useEffect(() => {
    if (viewClassId) fetchReport();
  }, [viewClassId, viewDateFrom, viewDateTo, viewSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const viewColumns = [
    { title: '#', key: 'index', width: 48, render: (_, __, i) => i + 1 },
    { title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 100 },
    {
      title: 'Student Name', dataIndex: 'studentName', key: 'studentName', width: 200,
      render: (text) => <Text strong>{text}</Text>,
    },
    {
      title: 'Present', dataIndex: 'totalPresent', key: 'totalPresent', width: 90,
      align: 'center',
      render: (val) => <Tag color="green">{val}</Tag>,
    },
    {
      title: 'Absent', dataIndex: 'totalAbsent', key: 'totalAbsent', width: 90,
      align: 'center',
      render: (val) => <Tag color="red">{val}</Tag>,
    },
    {
      title: 'Late', dataIndex: 'totalLate', key: 'totalLate', width: 80,
      align: 'center',
      render: (val) => val > 0 ? <Tag color="orange">{val}</Tag> : <Tag>0</Tag>,
    },
    {
      title: 'Total Days', dataIndex: 'totalDays', key: 'totalDays', width: 100,
      align: 'center',
    },
    {
      title: 'Attendance %', dataIndex: 'percentage', key: 'percentage', width: 120,
      align: 'center',
      sorter: (a, b) => a.percentage - b.percentage,
      render: (val) => {
        const color = val >= 85 ? '#22C55E' : val >= 75 ? '#F59E0B' : '#EF4444';
        return <Text strong style={{ color }}>{val}%</Text>;
      },
    },
  ];

  // ═══════════════════════════════════════════════════════════
  //  TAB ITEMS
  // ═══════════════════════════════════════════════════════════

  const tabItems = [
    {
      key: 'monthly',
      label: '📅 Monthly Entry',
      children: <MonthlyAttendanceEntry />,
    },
    {
      key: 'monthly-report',
      label: '📊 Monthly Report',
      children: <MonthlyAttendanceReport />,
    },
    {
      key: 'mark',
      label: 'Daily Mark',
      children: (
        <>
          {/* Filters */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8} md={5}>
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
            <Col xs={24} sm={8} md={5}>
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
            <Col xs={24} sm={8} md={5}>
              <DatePicker
                style={{ width: '100%' }}
                value={markDate}
                onChange={(val) => setMarkDate(val)}
                disabledDate={(d) => d && d.isAfter(dayjs(), 'day')}
                format="DD-MM-YYYY"
                id="mark-date-picker"
              />
            </Col>
            <Col xs={24} sm={8} md={5}>
              <Select
                placeholder="Session"
                style={{ width: '100%' }}
                value={markSession}
                onChange={(val) => setMarkSession(val)}
                options={sessions.map((s) => ({
                  label: typeof s === 'string' ? s : s.name,
                  value: typeof s === 'string' ? s : s.name,
                }))}
                id="mark-session-select"
              />
            </Col>
          </Row>

          {/* Lock banner */}
          {isLocked && (
            <div style={{
              background: '#FEF9C3', border: '1px solid #FDE047',
              borderRadius: 8, padding: '8px 14px', marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <LockOutlined style={{ color: '#CA8A04' }} />
              <Text style={{ color: '#92400E', fontWeight: 500 }}>
                Attendance is LOCKED for this session. Only admin can modify.
              </Text>
            </div>
          )}

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

          {/* Bulk actions */}
          {students.length > 0 && !isLocked && (
            <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
              <Button size="small" onClick={markAllPresent} style={{ color: '#22C55E', borderColor: '#22C55E' }}>
                ✓ All Present
              </Button>
              <Button size="small" onClick={markAllAbsent} style={{ color: '#EF4444', borderColor: '#EF4444' }}>
                ✗ All Absent
              </Button>
            </div>
          )}

          {/* Table */}
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
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {/* Save button: hidden when locked AND not admin */}
                  {(!isLocked || isAdmin) && (
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      size="large"
                      onClick={handleSave}
                      loading={saving}
                      disabled={saving}
                      id="save-attendance-btn"
                    >
                      {existingLoaded ? (isLocked ? 'Override (Admin)' : 'Update Attendance') : 'Save Attendance'}
                    </Button>
                  )}
                  {/* Lock button: visible to both admin and faculty */}
                  {existingLoaded && !isLocked && (
                    <Button
                      icon={<LockOutlined />}
                      size="large"
                      loading={locking}
                      onClick={handleLock}
                      style={{ background: '#F59E0B', borderColor: '#F59E0B', color: '#FFF' }}
                      id="lock-attendance-btn"
                    >
                      Lock Attendance
                    </Button>
                  )}
                  {existingLoaded && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {isLocked
                        ? '🔒 Locked — only admin can modify'
                        : '⚠ Attendance already saved — saving will update it.'}
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
      label: 'View Report',
      children: (
        <>
          {/* Filters */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={8} md={5}>
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
            <Col xs={24} sm={8} md={5}>
              <DatePicker
                style={{ width: '100%' }}
                value={viewDateFrom}
                onChange={(val) => setViewDateFrom(val)}
                placeholder="From date"
                format="DD-MM-YYYY"
                id="view-date-from"
              />
            </Col>
            <Col xs={24} sm={8} md={5}>
              <DatePicker
                style={{ width: '100%' }}
                value={viewDateTo}
                onChange={(val) => setViewDateTo(val)}
                placeholder="To date"
                format="DD-MM-YYYY"
                id="view-date-to"
              />
            </Col>
            <Col xs={24} sm={8} md={5}>
              <Select
                placeholder="All sessions"
                style={{ width: '100%' }}
                value={viewSession}
                onChange={(val) => setViewSession(val)}
                options={[
                  { label: 'All Sessions', value: undefined },
                  ...sessions.map((s) => ({
                    label: typeof s === 'string' ? s : s.name,
                    value: typeof s === 'string' ? s : s.name,
                  }))
                ]}
                allowClear
                id="view-session-select"
              />
            </Col>
          </Row>

          {/* Stats cards */}
          {reportStats && (
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={12} sm={6}>
                <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#64748B' }}>Students</span>}
                    value={reportStats.studentCount}
                    styles={{ content: { fontSize: 20, fontWeight: 700 } }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#64748B' }}>Total Present</span>}
                    value={reportStats.totalPresent}
                    styles={{ content: { fontSize: 20, fontWeight: 700, color: '#22C55E' } }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#64748B' }}>Total Absent</span>}
                    value={reportStats.totalAbsent}
                    styles={{ content: { fontSize: 20, fontWeight: 700, color: '#EF4444' } }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card size="small" variant="borderless" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#64748B' }}>Avg Attendance</span>}
                    value={reportStats.avgPercentage}
                    suffix="%"
                    prefix={<PercentageOutlined style={{ color: '#3B82F6' }} />}
                    styles={{ content: { fontSize: 20, fontWeight: 700, color: reportStats.avgPercentage >= 75 ? '#22C55E' : '#EF4444' } }}
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
              pagination={{ showSizeChanger: true, showTotal: (t) => `Total ${t} students`, pageSize: 20 }}
              scroll={{ x: 840 }}
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
        <Text type="secondary">Mark, lock, and track student attendance by session</Text>
      </div>

      <Tabs
        defaultActiveKey="monthly"
        items={tabItems}
        type="card"
        size="large"
        style={{ marginTop: 8 }}
      />
    </div>
  );
};

export default Attendance;
