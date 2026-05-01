import React from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import AppRouter from '@/router';

// Enterprise-grade Ant Design theme
const theme = {
  token: {
    colorPrimary: '#1B3A5C',
    colorSuccess: '#22C55E',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorInfo: '#3B82F6',
    borderRadius: 6,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,
    colorBgLayout: '#F0F2F5',
  },
  components: {
    Layout: {
      siderBg: '#0F172A',
      headerBg: '#FFFFFF',
    },
    Menu: {
      darkItemBg: '#0F172A',
      darkItemSelectedBg: '#1E3A5F',
      darkItemHoverBg: '#1E293B',
    },
    Table: {
      headerBg: '#F8FAFC',
      headerColor: '#475569',
    },
  },
};

const App = () => {
  return (
    <ConfigProvider theme={theme}>
      <AntApp>
        <AppRouter />
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
