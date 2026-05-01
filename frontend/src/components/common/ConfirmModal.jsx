import React, { useState, useEffect } from 'react';
import { Modal, Input, Typography } from 'antd';

const { Text } = Typography;
const { TextArea } = Input;

/**
 * Reusable confirmation modal with optional remarks input.
 *
 * @param {boolean}  open          - Controls visibility
 * @param {string}   title         - Modal title
 * @param {string}   description   - Helper text shown above the input
 * @param {string}   okText        - Confirm button label
 * @param {string}   okType        - Ant button type ('primary' | 'danger')
 * @param {boolean}  loading       - Disables confirm button & shows spinner
 * @param {boolean}  requireInput  - If true, shows a textarea and blocks confirm until filled
 * @param {string}   inputLabel    - Placeholder for the textarea
 * @param {function} onConfirm     - Called with (inputValue) on confirm
 * @param {function} onCancel      - Called when modal is closed / cancelled
 */
const ConfirmModal = ({
  open,
  title = 'Confirm Action',
  description,
  okText = 'Confirm',
  okType = 'primary',
  loading = false,
  requireInput = false,
  inputLabel = 'Enter remarks...',
  onConfirm,
  onCancel,
}) => {
  const [inputValue, setInputValue] = useState('');

  // Reset input whenever the modal opens/closes
  useEffect(() => {
    if (!open) setInputValue('');
  }, [open]);

  const handleOk = () => {
    onConfirm?.(inputValue);
  };

  const isConfirmDisabled = requireInput && !inputValue.trim();

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText={okText}
      okType={okType}
      okButtonProps={{ loading, disabled: isConfirmDisabled }}
      cancelButtonProps={{ disabled: loading }}
      destroyOnClose
      maskClosable={!loading}
    >
      {description && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          {description}
        </Text>
      )}
      {requireInput && (
        <TextArea
          rows={3}
          placeholder={inputLabel}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={loading}
          id="confirm-modal-input"
        />
      )}
    </Modal>
  );
};

export default ConfirmModal;
