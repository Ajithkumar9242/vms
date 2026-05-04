import React, { useEffect, useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import { notificationAPI } from '@/services/api';
import useFCM from '@/hooks/useFCM';

const FACULTY_NAV = (badge = 0) => [
  { to: '/faculty/attendance',    label: 'Attendance',  icon: '📋', exact: true },
  { to: '/faculty/students',      label: 'Students',    icon: '👨‍🎓' },
  { to: '/faculty/assignments',   label: 'Assignments', icon: '📝' },
  { to: '/faculty/materials',     label: 'Materials',   icon: '📚' },
  { to: '/faculty/notifications', label: 'Alerts',      icon: '🔔', badge },
  { to: '/faculty/profile',       label: 'Profile',     icon: '👤' },
];

const FacultyLayout = ({ title, subtitle, children }) => {
  const user = useAuthStore((s) => s.user);
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(() => {
    notificationAPI.getUnreadCount()
      .then((res) => setUnread(res?.data?.unreadCount ?? res?.data?.count ?? 0))
      .catch(() => {});
  }, []);

  useEffect(() => { refreshUnread(); }, [refreshUnread]);

  // Wire FCM — bump unread count on foreground push
  useFCM(() => refreshUnread());

  const navItems = FACULTY_NAV(unread);

  return (
    <div className="mobile-shell">
      <header className="mobile-header">
        <div>
          <div className="mobile-header-title">{title || 'Faculty Portal'}</div>
          <div className="mobile-header-sub">
            {subtitle || `Hello, ${user?.name?.split(' ')[0] || 'Faculty'}`}
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

export default FacultyLayout;
