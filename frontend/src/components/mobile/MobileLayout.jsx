import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';

/**
 * Shared Mobile Shell — wraps all mobile app pages.
 * Provides a sticky header + bottom nav + scrollable content area.
 */
const MobileLayout = ({ title, subtitle, navItems, headerRight, children }) => {
  return (
    <div className="mobile-shell">
      {/* Header */}
      <header className="mobile-header">
        <div>
          <div className="mobile-header-title">{title}</div>
          {subtitle && <div className="mobile-header-sub">{subtitle}</div>}
        </div>
        {headerRight && <div>{headerRight}</div>}
      </header>

      {/* Scrollable Content */}
      <main className="mobile-content m-fade-in">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="mobile-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `mobile-nav-item${isActive ? ' active' : ''}`
            }
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

export default MobileLayout;
