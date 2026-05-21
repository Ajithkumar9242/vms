import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, App, Select, Drawer, Form, Input,
  InputNumber, Tag, Popconfirm, Tooltip, Row, Col, Card, Typography,
  Spin, Empty, TimePicker,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { timetableAPI, setupAPI, schoolAPI, subjectAPI, facultyAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_COLORS = {
  Monday:    '#4F46E5',
  Tuesday:   '#0891B2',
  Wednesday: '#059669',
  Thursday:  '#D97706',
  Friday:    '#DC2626',
  Saturday:  '#7C3AED',
};

const formatTimeStr = (timeStr, format) => {
  if (!timeStr) return '—';
  if (format === '24') return timeStr;
  try {
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const padH = String(h12).padStart(2, '0');
    return `${padH}:${m} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

const TimetablePage = () => {
  const { message } = App.useApp();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = !['visitor', 'parent', 'student', 'accountant', 'faculty'].includes(role);

  // ── Lookup data ──────────────────────────────────────────────
  const [classes,      setClasses]      = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [subjects,     setSubjects]     = useState([]);
  const [faculties,    setFaculties]    = useState([]);
  const [sections,     setSections]     = useState([]);

  // ── Filter state ─────────────────────────────────────────────
  const [filterYear,  setFilterYear]  = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterDay,   setFilterDay]   = useState('');
  const [timeFormat,  setTimeFormat]  = useState('12'); // '12' or '24'

  // ── Table data ───────────────────────────────────────────────
  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(false);

  // ── Drawer ───────────────────────────────────────────────────
  const [drawer, setDrawer] = useState({ open: false, record: null });
  const [saving, setSaving] = useState(false);
  const [form]   = Form.useForm();

  // ── Load lookup data ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      setupAPI.getAcademicYears(),
      schoolAPI.getClasses(),
      subjectAPI.getAll({ isActive: true, limit: 500 }),
      facultyAPI.getAll({ limit: 500 }),
    ]).then(([years, cls, subjs, facs]) => {
      setAcademicYears(
        (years?.data || years || []).map((y) => ({ value: y._id, label: y.name || y.year }))
      );
      setClasses(
        (cls?.data || cls || []).map((c) => ({ value: c._id, label: c.name }))
      );
      const subjList = subjs?.data?.subjects || subjs?.data || subjs || [];
      setSubjects(Array.isArray(subjList) ? subjList.map((s) => ({ value: s._id, label: s.name })) : []);
      const facList = facs?.data?.faculty || facs?.data || facs || [];
      setFaculties(Array.isArray(facList) ? facList.map((f) => ({ value: f._id, label: f.name })) : []);
    }).catch(() => {});
  }, []);

  // ── Load sections helper ─────────────────────────────────────
  const fetchSectionsForClass = async (classId) => {
    if (!classId) {
      setSections([]);
      return;
    }
    try {
      const res = await schoolAPI.getSections({ classId });
      setSections(res?.data || res || []);
    } catch (e) {
      setSections([]);
    }
  };

  const handleClassChange = (value) => {
    form.setFieldsValue({ sectionId: undefined });
    fetchSectionsForClass(value);
  };

  // ── Fetch timetable ──────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    if (!filterYear || !filterClass) { setEntries([]); return; }
    setLoading(true);
    try {
      const params = { academicYearId: filterYear, classId: filterClass };
      if (filterDay) params.dayOfWeek = filterDay;
      const res = await timetableAPI.getAll(params);
      setEntries(res?.data || res || []);
    } catch (e) {
      message.error(e.message || 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterClass, filterDay]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // ── Drawer handlers ──────────────────────────────────────────
  const openCreate = () => {
    form.resetFields();
    if (filterClass) {
      fetchSectionsForClass(filterClass);
    } else {
      setSections([]);
    }
    form.setFieldsValue({
      academicYearId: filterYear || undefined,
      classId: filterClass || undefined,
      term: 'full',
    });
    setDrawer({ open: true, record: null });
  };

  const openEdit = (r) => {
    const classId = r.classId?._id || r.classId;
    fetchSectionsForClass(classId);
    form.setFieldsValue({
      academicYearId: r.academicYearId?._id || r.academicYearId,
      classId,
      sectionId:      r.sectionId?._id || r.sectionId,
      dayOfWeek:      r.dayOfWeek,
      periodNo:       r.periodNo,
      startTime:      r.startTime ? dayjs(`2000-01-01T${r.startTime}:00`) : null,
      endTime:        r.endTime ? dayjs(`2000-01-01T${r.endTime}:00`) : null,
      subjectId:      r.subjectId?._id || r.subjectId,
      facultyId:      r.facultyId?._id || r.facultyId,
      room:           r.room,
      term:           r.term || 'full',
    });
    setDrawer({ open: true, record: r });
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      setSaving(true);
      const payload = {
        ...vals,
        startTime: vals.startTime ? vals.startTime.format('HH:mm') : '',
        endTime: vals.endTime ? vals.endTime.format('HH:mm') : '',
      };
      if (drawer.record) {
        await timetableAPI.update(drawer.record._id, payload);
        message.success('Timetable entry updated');
      } else {
        await timetableAPI.create(payload);
        message.success('Timetable entry created');
      }
      setDrawer({ open: false, record: null });
      fetchEntries();
    } catch (e) {
      if (e?.errorFields) return; // validation
      message.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await timetableAPI.remove(id);
      message.success('Entry deleted');
      fetchEntries();
    } catch (e) { message.error(e.message || 'Delete failed'); }
  };

  // ── Grid view — group entries by day ──────────────────────────
  const byDay = DAYS.reduce((acc, d) => ({ ...acc, [d]: [] }), {});
  entries.forEach((e) => {
    if (byDay[e.dayOfWeek]) byDay[e.dayOfWeek].push(e);
  });

  // ── Table columns (flat list view) ───────────────────────────
  const columns = [
    {
      title: 'Day',
      dataIndex: 'dayOfWeek',
      width: 110,
      render: (d) => (
        <Tag color={DAY_COLORS[d] || 'default'} style={{ fontWeight: 600 }}>{d}</Tag>
      ),
      sorter: (a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek),
    },
    { title: 'Period', dataIndex: 'periodNo', width: 80, sorter: (a, b) => a.periodNo - b.periodNo },
    {
      title: 'Time',
      width: 140,
      render: (_, r) => <Text type="secondary">{formatTimeStr(r.startTime, timeFormat)}–{formatTimeStr(r.endTime, timeFormat)}</Text>,
    },
    {
      title: 'Section',
      render: (_, r) => r.sectionId?.name || '—',
    },
    {
      title: 'Subject',
      render: (_, r) => r.subjectId?.name || '—',
    },
    {
      title: 'Faculty',
      render: (_, r) => r.facultyId?.name || <Text type="secondary">Unassigned</Text>,
    },
    { title: 'Room', dataIndex: 'room', render: (v) => v || '—' },
    { title: 'Term', dataIndex: 'term', render: (v) => v || '—' },
    canWrite && {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, r) => (
        <Space>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm title="Delete this entry?" onConfirm={() => handleDelete(r._id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ].filter(Boolean);

  return (
    <div style={{ padding: '24px 24px 40px' }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col>
          <Space align="center">
            <CalendarOutlined style={{ fontSize: 24, color: '#C2410C' }} />
            <Title level={3} style={{ margin: 0 }}>Timetable</Title>
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchEntries}>Refresh</Button>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
                id="btn-add-timetable">
                Add Entry
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16, borderRadius: 10 }}>
        <Row gutter={12} align="middle" wrap>
          <Col xs={24} sm={8} md={6}>
            <Select
              placeholder="Academic Year *"
              style={{ width: '100%' }}
              value={filterYear || undefined}
              onChange={setFilterYear}
              options={academicYears}
              allowClear
              id="filter-year"
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Select
              placeholder="Class *"
              style={{ width: '100%' }}
              value={filterClass || undefined}
              onChange={setFilterClass}
              options={classes}
              allowClear
              id="filter-class"
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              placeholder="Filter by Day"
              style={{ width: '100%' }}
              value={filterDay || undefined}
              onChange={(v) => setFilterDay(v || '')}
              allowClear
              id="filter-day"
            >
              {DAYS.map((d) => <Option key={d} value={d}>{d}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Select
              placeholder="Format"
              style={{ width: '100%' }}
              value={timeFormat}
              onChange={setTimeFormat}
              id="filter-time-format"
            >
              <Option value="12">12-Hour (AM/PM)</Option>
              <Option value="24">24-Hour</Option>
            </Select>
          </Col>
          <Col>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {!filterYear || !filterClass ? 'Select year & class to load timetable' : `${entries.length} entries`}
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Weekly grid view */}
      {entries.length > 0 && !filterDay && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {DAYS.filter((d) => byDay[d].length > 0).map((day) => (
            <Col xs={24} sm={12} lg={8} key={day}>
              <Card
                size="small"
                title={<span style={{ color: DAY_COLORS[day], fontWeight: 700 }}>{day}</span>}
                style={{ borderRadius: 10, borderTop: `3px solid ${DAY_COLORS[day]}` }}
              >
                {byDay[day]
                  .sort((a, b) => a.periodNo - b.periodNo)
                  .map((e) => (
                    <div key={e._id} style={{
                      padding: '6px 8px', marginBottom: 6, borderRadius: 6,
                      background: '#F8FAFC', border: '1px solid #E2E8F0',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          P{e.periodNo} — {e.subjectId?.name || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B' }}>
                          {formatTimeStr(e.startTime, timeFormat)}–{formatTimeStr(e.endTime, timeFormat)}
                          {e.sectionId?.name ? ` • Sec ${e.sectionId.name}` : ''}
                          {e.facultyId?.name ? ` • ${e.facultyId.name}` : ''}
                          {e.room ? ` • ${e.room}` : ''}
                        </div>
                      </div>
                      {canWrite && (
                        <Space size={4}>
                          <Button size="small" icon={<EditOutlined />} type="text" onClick={() => openEdit(e)} />
                          <Popconfirm title="Delete?" onConfirm={() => handleDelete(e._id)}>
                            <Button size="small" icon={<DeleteOutlined />} type="text" danger />
                          </Popconfirm>
                        </Space>
                      )}
                    </div>
                  ))}
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Flat table (shown when day filter active or as fallback) */}
      {(filterDay || entries.length === 0) && (
        <Card style={{ borderRadius: 10 }}>
          <Spin spinning={loading}>
            {!filterYear || !filterClass ? (
              <Empty description="Select Academic Year and Class to view timetable" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                dataSource={entries}
                columns={columns}
                rowKey="_id"
                size="small"
                pagination={{ pageSize: 30, showSizeChanger: false }}
                scroll={{ x: 700 }}
              />
            )}
          </Spin>
        </Card>
      )}

      {/* Add/Edit Drawer */}
      <Drawer
        title={drawer.record ? 'Edit Timetable Entry' : 'Add Timetable Entry'}
        open={drawer.open}
        onClose={() => setDrawer({ open: false, record: null })}
        width={440}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setDrawer({ open: false, record: null })}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave} id="btn-save-timetable">Save</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="academicYearId" label="Academic Year" rules={[{ required: true }]}>
            <Select options={academicYears} placeholder="Select year" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="classId" label="Class" rules={[{ required: true }]}>
                <Select options={classes} placeholder="Class" onChange={handleClassChange} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sectionId" label="Section">
                <Select placeholder="Section (optional)" allowClear>
                  {sections.map((s) => <Option key={s._id} value={s._id}>{s.name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="dayOfWeek" label="Day" rules={[{ required: true }]}>
                <Select placeholder="Day">
                  {DAYS.map((d) => <Option key={d} value={d}>{d}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="periodNo" label="Period No." rules={[{ required: true }]}>
                <InputNumber min={1} max={12} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="startTime" label="Start Time" rules={[{ required: true, message: 'Start time is required' }]}>
                <TimePicker
                  format={timeFormat === '12' ? 'hh:mm A' : 'HH:mm'}
                  use12Hours={timeFormat === '12'}
                  minuteStep={5}
                  style={{ width: '100%' }}
                  placeholder="Select time"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endTime" label="End Time" rules={[{ required: true, message: 'End time is required' }]}>
                <TimePicker
                  format={timeFormat === '12' ? 'hh:mm A' : 'HH:mm'}
                  use12Hours={timeFormat === '12'}
                  minuteStep={5}
                  style={{ width: '100%' }}
                  placeholder="Select time"
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="subjectId" label="Subject" rules={[{ required: true }]}>
            <Select
              options={subjects}
              placeholder="Select subject"
              showSearch
              filterOption={(v, o) => o.label?.toLowerCase().includes(v.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="facultyId" label="Faculty">
            <Select
              options={faculties}
              placeholder="Select faculty (optional)"
              allowClear
              showSearch
              filterOption={(v, o) => o.label?.toLowerCase().includes(v.toLowerCase())}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="room" label="Room">
                <Input placeholder="e.g. A101" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="term" label="Term" initialValue="full">
                <Select>
                  <Option value="full">Full Year</Option>
                  <Option value="term1">Term 1</Option>
                  <Option value="term2">Term 2</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Drawer>
    </div>
  );
};

export default TimetablePage;
