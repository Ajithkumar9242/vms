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
  // BookOutlined, // Study Materials (temporarily hidden)
  FolderOpenOutlined,
  ShoppingCartOutlined,
  FileSearchOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import { ERP_COLORS } from '@/theme/colors';

const { Sider } = Layout;

// ─── Role groups (mirror router/index.jsx) ────────────────────
const SETUP_ROLES   = ['super_admin', 'admin'];
const HIGH_PRIV     = ['super_admin', 'admin', 'principal'];
const FINANCE_ROLES = ['super_admin', 'admin', 'principal', 'accountant'];
const STAFF_ROLES   = ['super_admin', 'admin', 'principal', 'faculty'];

const allMenuItems = [
  // ── Core ───────────────────────────────────────────────────
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
    roles: [...FINANCE_ROLES, 'faculty'],   // accountant sees dashboard
  },
  {
    key: '/students',
    icon: <TeamOutlined />,
    label: 'Students',
    roles: [...FINANCE_ROLES, 'faculty'],
  },
  {
    key: '/admissions',
    icon: <FormOutlined />,
    label: 'Admissions',
    roles: HIGH_PRIV,
  },

  // ── Academics ──────────────────────────────────────────────
  { type: 'divider', roles: STAFF_ROLES },
  {
    key: '/attendance',
    icon: <CalendarOutlined />,
    label: 'Attendance',
    roles: STAFF_ROLES,
  },
  {
    key: '/exams',
    icon: <TrophyOutlined />,
    label: 'Exams',
    roles: STAFF_ROLES,
  },
  {
    key: '/assignments',
    icon: <FileTextOutlined />,
    label: 'Assignments',
    roles: STAFF_ROLES,
  },
  {
    key: '/marks-entry',
    icon: <EditOutlined />,
    label: 'Marks Entry',
    roles: STAFF_ROLES,
  },
  // ── Study Materials: temporarily disabled ────────────────
  // {
  //   key: '/materials',
  //   icon: <BookOutlined />,
  //   label: 'Study Materials',
  //   roles: STAFF_ROLES,
  // },

  // ── People ─────────────────────────────────────────────────
  { type: 'divider', roles: HIGH_PRIV },
  {
    key: '/admin/faculty',
    icon: <UserSwitchOutlined />,
    label: 'Manage Faculty',
    roles: HIGH_PRIV,
  },
  {
    key: '/parents',
    icon: <UsergroupAddOutlined />,
    label: 'Parents',
    roles: HIGH_PRIV,
  },

  // ── Finance ────────────────────────────────────────────────
  { type: 'divider', roles: FINANCE_ROLES },
  {
    key: '/fees',
    icon: <DollarOutlined />,
    label: 'Fees',
    roles: FINANCE_ROLES,
  },
  {
    key: '/pos/billing',
    icon: <ShoppingCartOutlined />,
    label: 'POS Billing',
    roles: FINANCE_ROLES,
  },
  {
    key: '/pos/catalog',
    icon: <ShoppingCartOutlined />,
    label: 'POS Catalog',
    roles: FINANCE_ROLES,
  },
  {
    key: '/invoices',
    icon: <FileSearchOutlined />,
    label: 'Invoice Registry',
    roles: FINANCE_ROLES,
  },
  {
    key: '/vault/requests',
    icon: <FolderOpenOutlined />,
    label: 'Document Requests',
    roles: FINANCE_ROLES,
  },

  // ── Vault (admin/principal only) ───────────────────────────
  {
    key: '/vault/catalog',
    icon: <FolderOpenOutlined />,
    label: 'Document Catalog',
    roles: HIGH_PRIV,
  },
  {
    key: '/vault/students',
    icon: <FolderOpenOutlined />,
    label: 'Student Vault',
    roles: HIGH_PRIV,
  },

  // ── School Operations ──────────────────────────────────────
  { type: 'divider', roles: STAFF_ROLES },
  {
    key: '/hostel',
    icon: <HomeOutlined />,
    label: 'Hostel',
    roles: STAFF_ROLES,
  },
  {
    key: '/leave',
    icon: <FileProtectOutlined />,
    label: 'Leave / Gate Pass',
    roles: STAFF_ROLES,
  },
  {
    key: '/health',
    icon: <MedicineBoxOutlined />,
    label: 'Health Records',
    roles: STAFF_ROLES,
  },
  {
    key: '/incidents',
    icon: <WarningOutlined />,
    label: 'Incidents',
    roles: STAFF_ROLES,
  },
  {
    key: '/duty',
    icon: <ScheduleOutlined />,
    label: 'Staff Duty',
    roles: HIGH_PRIV,
  },

  // ── System ─────────────────────────────────────────────────
  { type: 'divider', roles: HIGH_PRIV },
  {
    key: '/communication',
    icon: <MessageOutlined />,
    label: 'Communication',
    roles: STAFF_ROLES,
  },
  {
    key: '/activity',
    icon: <HistoryOutlined />,
    label: 'Activity Logs',
    roles: HIGH_PRIV,
  },

  // ── Admin Setup (super_admin + admin only) ─────────────────
  { type: 'divider', roles: SETUP_ROLES },
  {
    key: '/setup',
    icon: <SettingOutlined />,
    label: 'Setup',
    roles: SETUP_ROLES,
  },
];

const Sidebar = ({ collapsed, onCollapse }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = useAuthStore((s) => s.user);
  const userRole  = user?.role || 'admin';

  // Filter items by role; strip the roles key before passing to Ant Menu
  const menuItems = allMenuItems
    .filter((item) => item.roles?.includes(userRole))
    .map(({ roles, ...rest }) => rest);

  // Highlight the current page
  const selectedKey = menuItems.find((item) =>
    item.key && (
      location.pathname === item.key ||
      (item.key !== '/' && location.pathname.startsWith(item.key))
    )
  )?.key || '/';

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
            background: `linear-gradient(135deg, ${ERP_COLORS.primary}, ${ERP_COLORS.secondary})`,
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
        onClick={({ key }) => navigate(key)}
        style={{ borderRight: 'none', marginTop: 8 }}
      />
    </Sider>
  );
};

export default Sidebar;
