import React from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  FormOutlined,
  DollarOutlined,
  CalendarOutlined,
  TrophyOutlined,
  UserSwitchOutlined,
  UsergroupAddOutlined,
  MessageOutlined,
  HistoryOutlined,
  HomeOutlined,
  FileProtectOutlined,
  MedicineBoxOutlined,
  WarningOutlined,
  ScheduleOutlined,
  SettingOutlined,
  FileTextOutlined,
  BookOutlined,
  FolderOpenOutlined,
  ShoppingCartOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/store/authStore';

const { Sider } = Layout;

// All menu items with role access control
const allMenuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
    roles: ['super_admin', 'admin', 'principal', 'faculty', 'parent'],
  },
  // {
  //   key: '/setup',
  //   icon: <SettingOutlined />,
  //   label: 'Setup Module',
  //   roles: ['super_admin', 'admin', 'principal', 'faculty', 'parent'],
  // },
  {
    key: '/students',
    icon: <TeamOutlined />,
    label: 'Students',
    roles: ['super_admin', 'admin', 'principal', 'faculty', 'parent'],
  },
  {
    key: '/admissions',
    icon: <FormOutlined />,
    label: 'Admissions',
    roles: ['super_admin', 'admin', 'principal'],
  },
  {
    key: '/fees',
    icon: <DollarOutlined />,
    label: 'Fees',
    roles: ['super_admin', 'admin', 'principal', 'parent'],
  },
  {
    key: '/attendance',
    icon: <CalendarOutlined />,
    label: 'Attendance',
    roles: ['super_admin', 'admin', 'principal', 'faculty'],
  },
  {
    key: '/exams',
    icon: <TrophyOutlined />,
    label: 'Exams',
    roles: ['super_admin', 'admin', 'principal', 'faculty', 'parent'],
  },
  {
    key: '/assignments',
    icon: <FileTextOutlined />,
    label: 'Assignments',
    roles: ['super_admin', 'admin', 'principal', 'faculty'],
  },
  {
    key: '/materials',
    icon: <BookOutlined />,
    label: 'Study Materials',
    roles: ['super_admin', 'admin', 'principal', 'faculty'],
  },
  {
    key: '/admin/faculty',
    icon: <UserSwitchOutlined />,
    label: 'Manage Faculty',
    roles: ['super_admin', 'admin', 'principal'],
  },
  {
    key: '/parents',
    icon: <UsergroupAddOutlined />,
    label: 'Parents',
    roles: ['super_admin', 'admin', 'principal'],
  },
  // ─── School Operations ─────────────────────────────────
  {
    type: 'divider',
    roles: ['super_admin', 'admin', 'principal', 'faculty'],
  },
  {
    key: '/hostel',
    icon: <HomeOutlined />,
    label: 'Hostel',
    roles: ['super_admin', 'admin', 'principal', 'faculty'],
  },
  {
    key: '/leave',
    icon: <FileProtectOutlined />,
    label: 'Leave / Gate Pass',
    roles: ['super_admin', 'admin', 'principal', 'faculty'],
  },
  {
    key: '/health',
    icon: <MedicineBoxOutlined />,
    label: 'Health Records',
    roles: ['super_admin', 'admin', 'principal', 'faculty'],
  },
  {
    key: '/incidents',
    icon: <WarningOutlined />,
    label: 'Incidents',
    roles: ['super_admin', 'admin', 'principal', 'faculty'],
  },
  {
    key: '/duty',
    icon: <ScheduleOutlined />,
    label: 'Staff Duty',
    roles: ['super_admin', 'admin', 'principal'],
  },
  // ─── System ────────────────────────────────────────────
  {
    type: 'divider',
    roles: ['super_admin', 'admin', 'principal', 'faculty'],
  },
  {
    key: '/communication',
    icon: <MessageOutlined />,
    label: 'Communication',
    roles: ['super_admin', 'admin', 'principal', 'faculty'],
  },
  {
    key: '/activity',
    icon: <HistoryOutlined />,
    label: 'Activity Logs',
    roles: ['super_admin', 'admin', 'principal'],
  },
  // ─── Admin Setup ───────────────────────────────────────
  {
    type: 'divider',
    roles: ['super_admin', 'admin'],
  },
  {
    key: '/setup',
    icon: <SettingOutlined />,
    label: 'Setup',
    roles: ['super_admin', 'admin'],
  },
  // ─── Vault / Documents ────────────────────────────────
  {
    type: 'divider',
    roles: ['super_admin', 'admin', 'principal'],
  },
  {
    key: '/vault/catalog',
    icon: <FolderOpenOutlined />,
    label: 'Document Catalog',
    roles: ['super_admin', 'admin', 'principal'],
  },
  {
    key: '/vault/requests',
    icon: <FolderOpenOutlined />,
    label: 'Document Requests',
    roles: ['super_admin', 'admin', 'principal'],
  },
  {
    key: '/vault/students',
    icon: <FolderOpenOutlined />,
    label: 'Student Vault',
    roles: ['super_admin', 'admin', 'principal'],
  },

  // ─── POS ──────────────────────────────────────────────
  {
    type: 'divider',
    roles: ['super_admin', 'admin', 'principal'],
  },
  {
    key: '/pos/catalog',
    icon: <ShoppingCartOutlined />,
    label: 'POS Catalog',
    roles: ['super_admin', 'admin', 'principal'],
  },
  {
    key: '/pos/billing',
    icon: <ShoppingCartOutlined />,
    label: 'POS Billing',
    roles: ['super_admin', 'admin', 'principal'],
  },

  // ─── Invoice Registry ─────────────────────────────────
  {
    type: 'divider',
    roles: ['super_admin', 'admin', 'principal'],
  },
  {
    key: '/invoices',
    icon: <FileSearchOutlined />,
    label: 'Invoice Registry',
    roles: ['super_admin', 'admin', 'principal'],
  },
  {
    key: '/invoices',
    icon: <FileTextOutlined />,
    label: 'Invoice Registry',
    roles: ['super_admin', 'admin', 'principal'],
  },
];

const Sidebar = ({ collapsed, onCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role || 'admin';

  // Filter menu items based on user role
  const menuItems = allMenuItems
    .filter((item) => item.roles.includes(userRole))
    .map(({ roles, ...rest }) => rest); // Strip roles from rendered items

  // Determine selected key from current path
  const selectedKey = menuItems.find((item) =>
    item.key && (
      location.pathname === item.key ||
      (item.key !== '/' && location.pathname.startsWith(item.key))
    )
  )?.key || '/';

  const onMenuClick = ({ key }) => {
    navigate(key);
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      breakpoint="lg"
      collapsedWidth={80}
      width={240}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
      }}
      theme="dark"
    >
      {/* Brand */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '0 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          transition: 'all 0.2s',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFF',
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
          }}
        >
          V
        </div>
        {!collapsed && (
          <span
            style={{
              color: '#F8FAFC',
              fontWeight: 600,
              fontSize: 16,
              marginLeft: 12,
              whiteSpace: 'nowrap',
            }}
          >
            VSS ERP
          </span>
        )}
      </div>

      {/* Navigation */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={onMenuClick}
        style={{ borderRight: 'none', marginTop: 8 }}
      />
    </Sider>
  );
};

export default Sidebar;
