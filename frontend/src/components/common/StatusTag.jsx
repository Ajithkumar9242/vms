import React from 'react';
import { Tag } from 'antd';

const STATUS_CONFIG = {
  pending: { color: 'orange', label: 'Pending' },
  approved: { color: 'green', label: 'Approved' },
  rejected: { color: 'red', label: 'Rejected' },
  active: { color: 'green', label: 'Active' },
  inactive: { color: 'default', label: 'Inactive' },
  paid: { color: 'green', label: 'Paid' },
  partial: { color: 'orange', label: 'Partial' },
};

/**
 * Reusable status tag — renders a colored Ant Design Tag
 * based on the status string.
 */
const StatusTag = ({ status }) => {
  const config = STATUS_CONFIG[status] || { color: 'default', label: status };
  return <Tag color={config.color}>{config.label}</Tag>;
};

export default StatusTag;
