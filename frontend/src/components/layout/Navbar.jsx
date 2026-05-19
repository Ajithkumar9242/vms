import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layout, Dropdown, Avatar, Typography, Space, App,
  Badge, Input, Popover, List, Empty, Tag, Spin,
} from 'antd';
import {
  UserOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  BellOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import { notificationAPI, searchAPI } from '@/services/api';
import { ERP_COLORS } from '@/theme/colors';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const { Header } = Layout;
const { Text } = Typography;

const Navbar = ({ collapsed, onToggle }) => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { user, logout } = useAuthStore();

  // ─── Notifications ─────────────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await notificationAPI.getUnreadCount();
      setUnreadCount(res.data.unreadCount);
    } catch {}
  }, []);

  const fetchNotifications = async () => {
    setNotifLoading(true);
    try {
      const res = await notificationAPI.getAll({ limit: 10 });
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch {} finally {
      setNotifLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  useEffect(() => { fetchUnread(); const t = setInterval(fetchUnread, 30000); return () => clearInterval(t); }, [fetchUnread]);

  const typeColors = { success: 'green', warning: 'orange', error: 'red', info: 'blue' };

  const notifContent = (
    <div style={{ width: 340, maxHeight: 400, overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0 8px', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong>Notifications</Text>
        {unreadCount > 0 && (
          <a onClick={handleMarkAllRead} style={{ fontSize: 12 }}>Mark all read</a>
        )}
      </div>
      {notifLoading ? (
        <div style={{ textAlign: 'center', padding: 30 }}><Spin /></div>
      ) : notifications.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No notifications" style={{ padding: 20 }} />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(item) => (
            <List.Item style={{ padding: '8px 0', opacity: item.isRead ? 0.6 : 1 }}>
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                  <Tag color={typeColors[item.type]} style={{ margin: 0, fontSize: 10 }}>{item.type}</Tag>
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{item.message}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{dayjs(item.createdAt).fromNow()}</div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  // ─── Global Search ─────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTimer = useRef(null);

  const handleSearch = (value) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!value || value.length < 2) {
      setSearchResults(null);
      setSearchOpen(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      setSearchOpen(true);
      try {
        const res = await searchAPI.search(value);
        setSearchResults(res.data);
      } catch {
        setSearchResults(null);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const searchContent = (
    <div style={{ width: 360, maxHeight: 400, overflow: 'auto' }}>
      {searchLoading ? (
        <div style={{ textAlign: 'center', padding: 30 }}><Spin /></div>
      ) : !searchResults || searchResults.totalResults === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No results" style={{ padding: 20 }} />
      ) : (
        <>
          {searchResults.students?.length > 0 && (
            <div>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Students</Text>
              <List
                size="small"
                dataSource={searchResults.students}
                renderItem={(s) => (
                  <List.Item style={{ padding: '6px 0', cursor: 'pointer' }} onClick={() => { setSearchOpen(false); navigate('/students'); }}>
                    <Text>{s.name}</Text>
                    <Tag>{s.rollNo}</Tag>
                  </List.Item>
                )}
              />
            </div>
          )}
          {searchResults.faculty?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Faculty</Text>
              <List
                size="small"
                dataSource={searchResults.faculty}
                renderItem={(f) => (
                  <List.Item style={{ padding: '6px 0', cursor: 'pointer' }} onClick={() => { setSearchOpen(false); navigate('/faculty'); }}>
                    <Text>{f.name}</Text>
                    <Tag color="orange">{f.employeeId}</Tag>
                  </List.Item>
                )}
              />
            </div>
          )}
          {searchResults.admissions?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase' }}>Admissions</Text>
              <List
                size="small"
                dataSource={searchResults.admissions}
                renderItem={(a) => (
                  <List.Item style={{ padding: '6px 0', cursor: 'pointer' }} onClick={() => { setSearchOpen(false); navigate('/admissions'); }}>
                    <Text>{a.studentName}</Text>
                    <Tag>{a.applicationNo}</Tag>
                  </List.Item>
                )}
              />
            </div>
          )}
        </>
      )}
    </div>
  );

  // ─── Logout ────────────────────────────────────────────────
  const handleLogout = () => {
    logout();
    message.success('Logged out successfully');
    navigate('/login', { replace: true });
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: (
        <div>
          <div style={{ fontWeight: 500 }}>{user?.name || 'Admin'}</div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>{user?.email}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign Out',
      danger: true,
      onClick: handleLogout,
    },
  ];

  const roleBadge = user?.role?.replace('_', ' ') || 'User';

  return (
    <Header
      style={{
        background: '#FFFFFF',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #F1F5F9',
        position: 'sticky',
        top: 0,
        zIndex: 99,
        height: 64,
      }}
    >
      {/* Left — Collapse Toggle */}
      <div
        onClick={onToggle}
        style={{ cursor: 'pointer', fontSize: 18, color: '#64748B', lineHeight: 1 }}
        id="sidebar-toggle"
      >
        {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      </div>

      {/* Center/Right — Search + Notifications + User */}
      <Space size={16}>
        {/* Global Search */}
        <Popover
          content={searchContent}
          open={searchOpen && searchQuery.length >= 2}
          onOpenChange={(open) => { if (!open) setSearchOpen(false); }}
          trigger="click"
          placement="bottomRight"
        >
          <Input
            prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ width: 220, borderRadius: 20 }}
            allowClear
            id="global-search"
          />
        </Popover>

        {/* Notification Bell */}
        <Popover
          content={notifContent}
          open={notifOpen}
          onOpenChange={(open) => { setNotifOpen(open); if (open) fetchNotifications(); }}
          trigger="click"
          placement="bottomRight"
        >
          <Badge count={unreadCount} size="small" offset={[-2, 2]}>
            <BellOutlined
              style={{ fontSize: 18, color: '#64748B', cursor: 'pointer' }}
              id="notification-bell"
            />
          </Badge>
        </Popover>

        {/* User Menu */}
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
          <Space style={{ cursor: 'pointer' }} id="user-menu">
            <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
              <Text strong style={{ fontSize: 13, display: 'block' }}>
                {user?.name || 'Admin'}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: '#94A3B8',
                  textTransform: 'capitalize',
                }}
              >
                {roleBadge}
              </Text>
            </div>
            <Avatar
              size={36}
              icon={<UserOutlined />}
              style={{ background: `linear-gradient(135deg, ${ERP_COLORS.sidebarActive}, ${ERP_COLORS.primary})` }}
            />
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default Navbar;
