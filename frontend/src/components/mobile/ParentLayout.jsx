import React, { useEffect, useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import { notificationAPI } from '@/services/api';
import useFCM from '@/hooks/useFCM';
import MobileSplash from './MobileSplash';
import {
  HomeOutlined, DollarOutlined, CalendarOutlined,
  FileTextOutlined, BellOutlined, UserOutlined,
} from '@ant-design/icons';

const PARENT_NAV = (badge = 0) => [
  { to: '/parent/dashboard',     label: 'Home',    icon: <HomeOutlined />,     exact: true },
  { to: '/parent/fees',          label: 'Fees',    icon: <DollarOutlined /> },
  { to: '/parent/attendance',    label: 'Attend',  icon: <CalendarOutlined /> },
  { to: '/parent/exams',         label: 'Exams',   icon: <FileTextOutlined /> },
  { to: '/parent/notifications', label: 'Alerts',  icon: <BellOutlined />,     badge },
  { to: '/parent/profile',       label: 'Profile', icon: <UserOutlined /> },
];

// Splash key shared with ParentLogin
const SPLASH_KEY = 'erp_show_splash_parent';

const ParentLayout = ({ title, subtitle, children }) => {
  const user = useAuthStore((s) => s.user);
  const [unread, setUnread] = useState(0);

  const [showSplash, setShowSplash] = useState(() => {
    if (localStorage.getItem(SPLASH_KEY) === '1') {
      localStorage.removeItem(SPLASH_KEY);
      return true;
    }
    const seenKey = 'erp_parent_splash_session_seen';
    if (!sessionStorage.getItem(seenKey)) return true;
    return false;
  });

  useEffect(() => {
    if (!showSplash) return undefined;
    sessionStorage.setItem('erp_parent_splash_session_seen', '1');
    const t = setTimeout(() => setShowSplash(false), 1100);
    return () => clearTimeout(t);
  }, [showSplash]);

  const refreshUnread = useCallback(() => {
    notificationAPI.getUnreadCount()
      .then((res) => setUnread(res?.data?.unreadCount ?? res?.data?.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => { refreshUnread(); }, [refreshUnread]);

  // Wire FCM — bump unread count when a foreground push arrives
  useFCM(() => refreshUnread());

  const navItems = PARENT_NAV(unread);

  return (
    <div className="mobile-shell">
      <MobileSplash open={showSplash} label="VMS School ERP — Parent" />

      <header className="mobile-header">
        <div>
          <div className="mobile-header-title">{title || 'Parent Portal'}</div>
          <div className="mobile-header-sub">
            {subtitle || `Welcome, ${user?.name?.split(' ')[0] || 'Parent'}`}
          </div>
        </div>
      </header>

      <main className="mobile-content m-fade-in">{children}</main>

      <nav className="mobile-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span className="mobile-nav-label">{item.label}</span>
            {item.badge > 0 && (
              <span className="mobile-nav-badge">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default ParentLayout;
