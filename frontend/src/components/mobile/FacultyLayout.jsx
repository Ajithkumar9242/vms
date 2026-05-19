import React, { useEffect, useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import { notificationAPI } from '@/services/api';
import useFCM from '@/hooks/useFCM';
import MobileSplash from './MobileSplash';
import {
  CalendarOutlined, TeamOutlined, FileTextOutlined,
  BellOutlined, UserOutlined, EditOutlined,
} from '@ant-design/icons';

const FACULTY_NAV = (badge = 0) => [
  { to: '/faculty-app/attendance',    label: 'Attendance',  icon: <CalendarOutlined />,  exact: true },
  { to: '/faculty-app/students',      label: 'Students',    icon: <TeamOutlined /> },
  { to: '/faculty-app/assignments',   label: 'Assignments', icon: <FileTextOutlined /> },
  { to: '/faculty-app/marks',         label: 'Marks',       icon: <EditOutlined /> },
  { to: '/faculty-app/notifications', label: 'Alerts',      icon: <BellOutlined />,      badge },
  { to: '/faculty-app/profile',       label: 'Profile',     icon: <UserOutlined /> },
];

// Splash key shared with FacultyLogin
const SPLASH_KEY = 'erp_show_splash_faculty';

const FacultyLayout = ({ title, subtitle, children }) => {
  const user = useAuthStore((s) => s.user);
  const [unread, setUnread] = useState(0);

  // Show splash if login page set the flag OR on very first mount (if logged in)
  const [showSplash, setShowSplash] = useState(() => {
    if (localStorage.getItem(SPLASH_KEY) === '1') {
      localStorage.removeItem(SPLASH_KEY);
      return true;
    }
    // Also show on very first session view
    const seenKey = 'erp_faculty_splash_session_seen';
    if (!sessionStorage.getItem(seenKey)) return true;
    return false;
  });

  useEffect(() => {
    if (!showSplash) return undefined;
    // Mark seen so subsequent page navigations don't re-show
    sessionStorage.setItem('erp_faculty_splash_session_seen', '1');
    const t = setTimeout(() => setShowSplash(false), 1100);
    return () => clearTimeout(t);
  }, [showSplash]);

  const refreshUnread = useCallback(() => {
    notificationAPI.getUnreadCount()
      .then((res) => setUnread(res?.data?.unreadCount ?? res?.data?.count ?? 0))
      .catch(() => { });
  }, []);

  useEffect(() => { refreshUnread(); }, [refreshUnread]);

  // Wire FCM — bump unread count on foreground push
  useFCM(() => refreshUnread());

  const navItems = FACULTY_NAV(unread);

  return (
    <div className="mobile-shell">
      <MobileSplash open={showSplash} label="VMS School ERP — Faculty" />

      <header className="mobile-header">
        <div>
          <div className="mobile-header-title">{title || 'Faculty Portal'}</div>
          <div className="mobile-header-sub">
            {subtitle || `Hello, ${user?.name?.split(' ')[0] || 'Faculty'}`}
          </div>
        </div>
      </header>

      <main className="mobile-content mobile-content--full m-fade-in">{children}</main>

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

export default FacultyLayout;
