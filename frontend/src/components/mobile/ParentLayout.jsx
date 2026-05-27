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

  // Retrieve active selected child details
  const allLinked = user?.linkedEntity?.linkedStudents || [];
  const storedIdx = parseInt(localStorage.getItem('vms_selected_child_idx') || '0', 10);
  const safeIdx = allLinked.length > 0 ? Math.min(Math.max(0, storedIdx), allLinked.length - 1) : 0;
  const activeChild = allLinked[safeIdx];
  const activeChildName = activeChild?.name || user?.studentName || 'Student';
  const activeChildClass = activeChild?.classId?.name || '';

  return (
    <div className="mobile-shell">
      <MobileSplash open={showSplash} label="VMS School ERP — Parent" />

      <header className="mobile-header" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            {/* Prominently show child name first */}
            <div className="mobile-header-title" style={{ fontSize: '16px', fontWeight: 800, color: '#fff', textTransform: 'uppercase' }}>
              {activeChildName}
            </div>
            {/* Parent name and Class info secondary */}
            <div className="mobile-header-sub" style={{ fontSize: '11px', opacity: 0.85 }}>
              {activeChildClass ? `Class: ${activeChildClass} · ` : ''}Parent: {user?.name || 'Parent'}
            </div>
          </div>

          {/* Child Switcher dropdown if multiple children exist */}
          {allLinked.length > 1 && (
            <select
              value={safeIdx}
              onChange={(e) => {
                localStorage.setItem('vms_selected_child_idx', e.target.value);
                window.location.reload();
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {allLinked.map((c, idx) => (
                <option key={c._id || idx} value={idx} style={{ color: '#0F172A' }}>
                  {c.name?.split(' ')[0] || `Child ${idx + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* If page specific title is passed, display it as secondary indicator */}
        {title && title !== 'Parent Portal' && (
          <div style={{
            fontSize: '13px',
            fontWeight: 700,
            borderTop: '1px solid rgba(255, 255, 255, 0.15)',
            paddingTop: '6px',
            marginTop: '2px',
            color: '#fff'
          }}>
            {title} {subtitle && <span style={{ fontWeight: 400, fontSize: '11px', opacity: 0.8 }}> — {subtitle}</span>}
          </div>
        )}
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
