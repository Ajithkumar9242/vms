import React, { useEffect } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import AppRouter from '@/router';
import useAuthStore from '@/store/authStore';
import { ERP_COLORS } from '@/theme/colors';

// Enterprise-grade Ant Design theme
const theme = {
 token: {
    colorPrimary: ERP_COLORS.primary,
    colorSuccess: '#22C55E',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    colorInfo: '#3B82F6',
    borderRadius: 6,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 14,
    colorBgLayout: ERP_COLORS.layout,
  },
  components: {
    Layout: {
      siderBg: ERP_COLORS.sidebar,
      headerBg: '#FFFFFF',
    },
    Menu: {
      darkItemBg: ERP_COLORS.sidebar,
      darkItemSelectedBg: ERP_COLORS.primary,
      darkItemHoverBg: '#1E293B',
    },
    Table: {
      headerBg: '#F8FAFC',
      headerColor: '#475569',
    },
  },
};

const App = () => {
  const token = useAuthStore((s) => s.token);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (token) fetchMe();
  }, [token, fetchMe]);

  return (
    <ConfigProvider theme={theme}>
      <AntApp>
        <AppRouter />
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
