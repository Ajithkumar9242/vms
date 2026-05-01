import React from 'react';
import { Spin } from 'antd';

/**
 * Full-page loading spinner.
 */
const Loader = ({ tip = 'Loading...' }) => {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#F0F2F5',
      }}
    >
      <Spin size="large" description={tip}>
        <div style={{ padding: 50 }} />
      </Spin>
    </div>
  );
};

export default Loader;
