import React, { useEffect } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import AppRouter from '@/router';
import useAuthStore from '@/store/authStore';
import { THEME } from '@/theme/colors';

const App = () => {
  const token = useAuthStore((s) => s.token);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (token) fetchMe();
  }, [token, fetchMe]);

  return (
    <ConfigProvider theme={THEME}>
      <AntApp>
        <AppRouter />
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
