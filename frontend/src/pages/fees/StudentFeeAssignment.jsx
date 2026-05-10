import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Select, Button, Space, App, Typography, Tag, Checkbox,
  InputNumber, Tooltip, Badge, Modal, Form, Input, Row, Col,
  Spin, Alert, Statistic, Card, Divider, Popconfirm, DatePicker,
} from 'antd';
import {
  SaveOutlined, LockOutlined, UnlockOutlined, PlusOutlined,
  CheckCircleFilled, CloseCircleFilled, ExclamationCircleOutlined,
  DownloadOutlined, ReloadOutlined, CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { feesAPI, schoolAPI } from '@/services/api';
import useAuthStore from '@/store/authStore';

const { Title, Text } = Typography;

const DISCOUNT_TYPES = [
  { label: 'Scholarship', value: 'scholarship' },
  { label: 'Sibling', value: 'sibling' },
  { label: 'Staff Child', value: 'staff_child' },
  { label: 'Custom', value: 'custom' },
];

const StudentFeeAssignment = () => {
  const { message, modal } = App.useApp();
  const user = useAuthStore(s => s.user);
  const isAdmin = ['admin', 'super_admin', 'principal'].includes(user?.role);

  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matrixData, setMatrixData] = useState(null); // { students, components }
  const [rows, setRows] = useState({});   // { studentId: { componentId: bool, discounts: [], installments: [] } }
  const [discountModal, setDiscountModal] = useState({ open: false, studentId: null, studentName: '' });
  const [discountForm] = Form.useForm();
  const [instModal, setInstModal] = useState({ open: false, studentId: null, studentName: '', netFee: 0 });
  const [instForm] = Form.useForm();
  const [hasChanges, setHasChanges] = useState(false);

  // Load classes
  useEffect(() => {
    schoolAPI.getClasses({ limit: 50 }).then(res => setClasses(res.data || [])).catch(() => { });
  }, []);

  const loadMatrix = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setHasChanges(false);
    try {
      const res = await feesAPI.getClassMatrix(classId);
      const data = res?.data || res;
      setMatrixData(data);

      // Hydrate rows from backend componentChecks — use explicit String() keys
      // so they always match comp._id keys used in the checkbox render.
      const initRows = {};
      for (const student of data.students || []) {
        const sid = String(student.studentId);
        const checks = {};
        for (const [cid, val] of Object.entries(student.componentChecks || {})) {
          checks[String(cid)] = val;
        }
        initRows[sid] = {
          checks,
          discounts: student.discounts || [],
          installments: student.installments || [],
        };
      }
      setRows(initRows);
    } catch (e) {
      message.error(e.message || 'Failed to load class matrix');
    } finally {
      setLoading(false);
    }
  }, [classId, message]);

  useEffect(() => { loadMatrix(); }, [loadMatrix]);

  const handleCheck = (studentId, componentId, mandatory, value) => {
    if (mandatory) return; // cannot uncheck mandatory
    const sid = String(studentId);
    const cid = String(componentId);
    setRows(prev => ({
      ...prev,
      [sid]: {
        ...prev[sid],
        checks: { ...(prev[sid]?.checks || {}), [cid]: value },
      },
    }));
    setHasChanges(true);
  };

  const handleBulkCheck = (componentId, value) => {
    setRows(prev => {
      const updated = { ...prev };
      for (const student of matrixData?.students || []) {
        const comp = matrixData.components.find(c => c._id === componentId);
        if (comp?.mandatory) continue; // skip mandatory
        if (!updated[student.studentId]) updated[student.studentId] = { checks: {}, discounts: [], installments: [] };
        updated[student.studentId] = {
          ...updated[student.studentId],
          checks: { ...(updated[student.studentId].checks || {}), [componentId]: value },
        };
      }
      return updated;
    });
    setHasChanges(true);
  };

  const handleBulkSave = async () => {
    if (!classId || !matrixData) return;
    setSaving(true);
    try {
      const payloadRows = (matrixData.students || []).map(student => {
        const studentRows = rows[student.studentId] || {};
        const selectedComponentIds = Object.entries(studentRows.checks || {})
          .filter(([, checked]) => checked)
          .map(([compId]) => compId);
        return {
          studentId: student.studentId,
          selectedComponentIds,
          discounts: studentRows.discounts || [],
          installments: studentRows.installments || [],
        };
      });

      const res = await feesAPI.bulkSaveProfiles({ classId, rows: payloadRows });
      message.success(`Saved ${res.data?.saved || 0} profiles. ${res.data?.skipped || 0} locked students skipped.`);
      setHasChanges(false);
      await loadMatrix(); // refresh
    } catch (e) {
      message.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleLockStudent = async (student) => {
    modal.confirm({
      title: `Lock fee profile for ${student.name}?`,
      content: 'Once locked, this profile cannot be edited without admin unlock.',
      icon: <LockOutlined style={{ color: '#EF4444' }} />,
      okText: 'Lock',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await feesAPI.lockProfile(student.studentId, { academicYearId: undefined });
          message.success(`Profile locked for ${student.name}`);
          loadMatrix();
        } catch (e) {
          message.error(e.message);
        }
      },
    });
  };

  const handleUnlockStudent = async (student) => {
    try {
      await feesAPI.unlockProfile(student.studentId, { academicYearId: undefined });
      message.success(`Profile unlocked for ${student.name}`);
      loadMatrix();
    } catch (e) {
      message.error(e.message);
    }
  };

  const openDiscountModal = (student) => {
    discountForm.resetFields();
    setDiscountModal({ open: true, studentId: student.studentId, studentName: student.name });
  };

  const handleAddDiscount = async () => {
    try {
      const values = await discountForm.validateFields();
      await feesAPI.addDiscount(discountModal.studentId, values);
      message.success('Discount added');
      setDiscountModal({ open: false, studentId: null, studentName: '' });
      loadMatrix();
    } catch (e) {
      if (e.errorFields) return;
      message.error(e.message || 'Failed to add discount');
    }
  };

  const openInstallmentModal = (student) => {
    const studentRows = rows[student.studentId];
    const netFee = computedTotals[student.studentId]?.net || 0;
    let currentInsts = studentRows?.installments || [];
    
    if (currentInsts.length === 0) {
      currentInsts = [{ label: 'Full Payment', amount: netFee, dueDate: null }];
    }

    instForm.setFieldsValue({
      installments: currentInsts.map(i => ({
        ...i,
        dueDate: i.dueDate ? dayjs(i.dueDate) : null
      }))
    });
    setInstModal({ open: true, studentId: student.studentId, studentName: student.name, netFee });
  };

  const handleSaveInstallments = async () => {
    try {
      const values = await instForm.validateFields();
      const newInsts = values.installments.map((i, idx) => ({
        installmentNo: idx + 1,
        label: i.label,
        amount: i.amount,
        dueDate: i.dueDate ? i.dueDate.toISOString() : null,
      }));

      // Validate sum
      const sum = newInsts.reduce((a, b) => a + (b.amount || 0), 0);
      if (sum !== instModal.netFee) {
        message.error(`Installment sum (Rs.${sum}) must equal net fee (Rs.${instModal.netFee})`);
        return;
      }

      setRows(prev => ({
        ...prev,
        [instModal.studentId]: {
          ...prev[instModal.studentId],
          installments: newInsts
        }
      }));
      setHasChanges(true);
      setInstModal({ open: false, studentId: null, studentName: '', netFee: 0 });
    } catch (e) {
      // form validation failed
    }
  };

  // Compute totals per student
  const computedTotals = useMemo(() => {
    if (!matrixData) return {};
    const totals = {};
    for (const student of matrixData.students || []) {
      const studentRows = rows[student.studentId] || {};
      let total = 0;
      for (const comp of matrixData.components || []) {
        const checked = studentRows.checks?.[comp._id] ?? (comp.mandatory);
        if (checked) total += comp.amount;
      }
      // Apply discounts
      let disc = 0;
      for (const d of studentRows.discounts || []) {
        if (d.discountType === 'percent') disc += Math.round((total * d.value) / 100);
        else disc += d.value;
      }
      totals[student.studentId] = { gross: total, discount: disc, net: Math.max(0, total - disc) };
    }
    return totals;
  }, [matrixData, rows]);

  // Summary stats
  const totalStudents = matrixData?.students?.length || 0;
  const totalFeeSum = Object.values(computedTotals).reduce((s, t) => s + t.net, 0);
  const lockedCount = (matrixData?.students || []).filter(s => s.locked).length;

  // ─── Table columns ─────────────────────────────────────────
  const columns = useMemo(() => {
    if (!matrixData) return [];

    const fixedCols = [
      {
        title: 'Student', key: 'student', fixed: 'left', width: 180,
        render: (_, s) => (
          <div>
            <Text strong style={{ fontSize: 13 }}>{s.name}</Text>
            {s.locked && <Tag color="red" style={{ marginLeft: 4, fontSize: 10 }}>🔒 Locked</Tag>}
            <br />
            <Text type="secondary" style={{ fontSize: 11 }}>{s.admissionNo || s.rollNo}</Text>
          </div>
        ),
      },
    ];

    const compCols = (matrixData.components || []).map(comp => ({
      title: (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#1B3A5C' }}>{comp.name}</div>
          <div style={{ fontSize: 10, color: '#64748B' }}>₹{comp.amount?.toLocaleString('en-IN')}</div>
          {comp.mandatory && <Tag color="red" style={{ fontSize: 9, padding: '0 4px' }}>Mandatory</Tag>}
          {isAdmin && !comp.mandatory && (
            <div style={{ marginTop: 4 }}>
              <Button size="small" type="link" style={{ fontSize: 10, padding: '0 2px', height: 'auto' }}
                onClick={() => handleBulkCheck(comp._id, true)}>All ✓</Button>
              <Button size="small" type="link" danger style={{ fontSize: 10, padding: '0 2px', height: 'auto' }}
                onClick={() => handleBulkCheck(comp._id, false)}>None</Button>
            </div>
          )}
        </div>
      ),
      key: comp._id,
      width: 110,
      align: 'center',
      render: (_, student) => {
        const mandatory = comp.mandatory;
        const locked    = student.locked;
        const sid       = String(student.studentId);
        const cid       = String(comp._id);

        // Explicit precedence — never let a stale `false` shadow backend truth:
        //   1. rows state (user's unsaved edits in this session)
        //   2. backend componentChecks (source of truth after any reload)
        //   3. mandatory flag
        //   4. false
        const rowEntry  = rows?.[sid]?.checks;
        const rowsVal   = rowEntry !== undefined ? rowEntry[cid] : undefined;
        const apiVal    = student?.componentChecks?.[cid];
        const checked   = rowsVal !== undefined ? rowsVal
                        : apiVal  !== undefined ? apiVal
                        : (mandatory || false);

        return (
          <Checkbox
            checked={mandatory || checked}
            disabled={mandatory || locked || !isAdmin}
            onChange={e =>
              handleCheck(student.studentId, comp._id, mandatory, e.target.checked)
            }
          />
        );
      },
    }));

    const actionCols = [
      {
        title: 'Discount', key: 'discount', width: 90, align: 'right',
        render: (_, s) => {
          const t = computedTotals[s.studentId];
          return t?.discount > 0
            ? <Tag color="green">-₹{t.discount.toLocaleString('en-IN')}</Tag>
            : <Text type="secondary">—</Text>;
        },
      },
      {
        title: 'Net Fee', key: 'netFee', width: 100, align: 'right',
        render: (_, s) => {
          const t = computedTotals[s.studentId];
          return <Text strong style={{ color: '#1B3A5C' }}>₹{(t?.net || 0).toLocaleString('en-IN')}</Text>;
        },
      },
      {
        title: 'Actions', key: 'actions', width: 150, fixed: 'right',
        render: (_, s) => (
          <Space size="small">
            {isAdmin && (
              <>
                <Tooltip title="Add Discount">
                  <Button size="small" icon={<PlusOutlined />}
                    disabled={s.locked}
                    onClick={() => openDiscountModal(s)}>Disc.</Button>
                </Tooltip>
                <Tooltip title="Installments">
                  <Button size="small" icon={<CalendarOutlined />}
                    disabled={s.locked}
                    onClick={() => openInstallmentModal(s)}>Sch.</Button>
                </Tooltip>
                {s.locked ? (
                  <Tooltip title="Unlock Profile">
                    <Button size="small" icon={<UnlockOutlined />} type="primary"
                      onClick={() => handleUnlockStudent(s)}>Unlock</Button>
                  </Tooltip>
                ) : (
                  <Tooltip title="Lock Profile">
                    <Button size="small" icon={<LockOutlined />} danger
                      onClick={() => handleLockStudent(s)}>Lock</Button>
                  </Tooltip>
                )}
              </>
            )}
          </Space>
        ),
      },
    ];

    return [...fixedCols, ...compCols, ...actionCols];
  }, [matrixData, rows, computedTotals, isAdmin]);

  return (
    <div>
      {/* Filter Bar */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8} md={6}>
          <Select
            placeholder="Select Class"
            style={{ width: '100%' }}
            value={classId}
            onChange={v => { setClassId(v); setHasChanges(false); }}
            options={classes.map(c => ({ label: c.name, value: c._id }))}
            id="fee-assignment-class-select"
          />
        </Col>
        <Col>
          <Button icon={<ReloadOutlined />} onClick={loadMatrix} disabled={!classId}>Refresh</Button>
        </Col>
        {isAdmin && hasChanges && (
          <Col>
            <Badge dot>
              <Button type="primary" icon={<SaveOutlined />} loading={saving}
                onClick={handleBulkSave} id="btn-bulk-save-profiles">
                Save All Changes
              </Button>
            </Badge>
          </Col>
        )}
        {isAdmin && !hasChanges && matrixData && (
          <Col>
            <Button type="primary" icon={<SaveOutlined />} loading={saving}
              onClick={handleBulkSave} id="btn-bulk-save-profiles-2">
              Save / Update All
            </Button>
          </Col>
        )}
      </Row>

      {/* Summary Cards */}
      {matrixData && (
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          {[
            { label: 'Total Students', value: totalStudents, color: '#3B82F6' },
            { label: 'Locked Profiles', value: lockedCount, color: '#EF4444' },
            { label: 'Components', value: matrixData.components?.length || 0, color: '#8B5CF6' },
            { label: 'Total Fee (Class)', value: `₹${totalFeeSum.toLocaleString('en-IN')}`, color: '#1B3A5C' },
          ].map(card => (
            <Col xs={12} sm={6} key={card.label}>
              <Card size="small" style={{ borderRadius: 10, borderTop: `3px solid ${card.color}` }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{card.label}</div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Info Banner */}
      {matrixData && (
        <Alert
          type="info"
          style={{ marginBottom: 16, fontSize: 12 }}
          message={
            <>
              <strong>How to use:</strong> Check/uncheck components per student. Mandatory components (marked in red) auto-apply and cannot be removed.
              Click <strong>Save All Changes</strong> to generate/update invoices for all students.
              {lockedCount > 0 && <> · <Text type="danger">{lockedCount} students are locked and will be skipped.</Text></>}
            </>
          }
          showIcon
        />
      )}

      {/* No class selected */}
      {!classId && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏫</div>
          <Text type="secondary">Select a class above to view and assign fees to students</Text>
        </div>
      )}

      {/* Spreadsheet Table */}
      {classId && (
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={matrixData?.students || []}
            rowKey="studentId"
            loading={false}
            scroll={{ x: 200 + (matrixData?.components?.length || 0) * 110 + 340 }}
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: t => `${t} students` }}
            size="small"
            bordered
            rowClassName={s => s.locked ? 'ant-table-row-disabled' : ''}
            style={{ background: '#FFF', borderRadius: 8 }}
          />
        </Spin>
      )}

      {/* Discount Modal */}
      <Modal
        title={`Add Discount — ${discountModal.studentName}`}
        open={discountModal.open}
        onOk={handleAddDiscount}
        onCancel={() => setDiscountModal({ open: false, studentId: null, studentName: '' })}
        okText="Add Discount"
        destroyOnClose
      >
        <Form form={discountForm} layout="vertical">
          <Form.Item name="type" label="Discount Type" rules={[{ required: true }]}>
            <Select options={DISCOUNT_TYPES} />
          </Form.Item>
          <Form.Item name="label" label="Label (optional)">
            <Input placeholder="e.g. 50% Merit Scholarship" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="discountType" label="Discount Mode" rules={[{ required: true }]}>
                <Select options={[
                  { label: 'Fixed Amount (₹)', value: 'fixed' },
                  { label: 'Percentage (%)', value: 'percent' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="value" label="Value" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={2} placeholder="Reason for discount" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Installment Schedule Modal */}
      <Modal
        title={`Installment Schedule — ${instModal.studentName} (Net Fee: Rs.${instModal.netFee})`}
        open={instModal.open}
        onOk={handleSaveInstallments}
        onCancel={() => setInstModal({ open: false, studentId: null, studentName: '', netFee: 0 })}
        width={600}
        okText="Save Schedule"
        destroyOnClose
      >
        <Alert type="info" message={`Ensure the sum of installments matches the net fee exactly.`} style={{ marginBottom: 16 }} />
        <Form form={instForm}>
          <Form.List name="installments">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col span={9}>
                      <Form.Item {...restField} name={[name, 'label']} rules={[{ required: true, message: 'Label required' }]} style={{ marginBottom: 0 }}>
                        <Input placeholder="e.g. Term 1" />
                      </Form.Item>
                    </Col>
                    <Col span={7}>
                      <Form.Item {...restField} name={[name, 'amount']} rules={[{ required: true, message: 'Amount required' }]} style={{ marginBottom: 0 }}>
                        <InputNumber style={{ width: '100%' }} placeholder="Amount" />
                      </Form.Item>
                    </Col>
                    <Col span={6}>
                      <Form.Item {...restField} name={[name, 'dueDate']} style={{ marginBottom: 0 }}>
                        <DatePicker style={{ width: '100%' }} placeholder="Due Date" format="YYYY-MM-DD" />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button type="text" danger icon={<CloseCircleFilled />} onClick={() => remove(name)} />
                    </Col>
                  </Row>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  Add Installment
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
};

export default StudentFeeAssignment;
