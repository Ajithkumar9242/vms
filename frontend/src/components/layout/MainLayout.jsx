import React, { useState, useEffect } from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const { Content } = Layout;

const MOBILE_BREAKPOINT = 768;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // ─── Detect mobile viewport ──────────────────────────────
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ─── Handle sidebar toggle ───────────────────────────────
  const handleToggle = () => {
    setCollapsed((prev) => !prev);
  };

  // On mobile, clicking overlay closes sidebar
  const handleOverlayClick = () => {
    if (isMobile && !collapsed) {
      setCollapsed(true);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} onCollapse={setCollapsed} />

      {/* Mobile overlay when sidebar is open */}
      {isMobile && !collapsed && (
        <div className="sidebar-overlay" onClick={handleOverlayClick} />
      )}

      <Layout
        style={{
          marginLeft: isMobile ? 0 : (collapsed ? 80 : 240),
          transition: 'margin-left 0.2s',
        }}
      >
        <Navbar
          collapsed={collapsed}
          onToggle={handleToggle}
        />

        <Content
          style={{
            margin: 0,
            minHeight: 'calc(100vh - 64px)',
            overflow: 'auto',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
