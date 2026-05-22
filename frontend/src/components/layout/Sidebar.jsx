import React, { useState, useEffect } from 'react';
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
  TableOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/store/authStore';
import { ERP_COLORS } from '@/theme/colors';
import { setupAPI } from '@/services/api';

const { Sider } = Layout;

// ─── Role groups (mirror router/index.jsx) ────────────────────
const SETUP_ROLES = ['super_admin', 'admin', 'visitor'];
const HIGH_PRIV = ['super_admin', 'admin', 'principal', 'visitor'];
const FINANCE_ROLES = ['super_admin', 'admin', 'principal', 'accountant', 'visitor'];
const STAFF_ROLES = ['super_admin', 'admin', 'principal', 'faculty', 'visitor'];

const allMenuItems = [
  // ── Core ───────────────────────────────────────────────────
  {
    key: '/dashboard',
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
    key: '/timetable',
    icon: <TableOutlined />,
    label: 'Timetable',
    roles: [...STAFF_ROLES, 'accountant'],
  },
  // {
  //   key: '/assignments',
  //   icon: <FileTextOutlined />,
  //   label: 'Assignments',
  //   roles: STAFF_ROLES,
  // },
  // {
  //   // key: '/marks-entry',
  //   icon: <EditOutlined />,
  //   label: 'Marks Entry',
  //   roles: STAFF_ROLES,
  // },
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
    key: '/fees/discounts',
    icon: <FileTextOutlined />,
    label: 'Discount List',
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
  const navigate = useNavigate();
  const location = useLocation();
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    setupAPI.getSchoolSetting()
      .then((res) => {
        if (res.data?.logoUrl) {
          setLogoUrl(res.data.logoUrl);
        }
      })
      .catch(() => { });
  }, []);
  const user = useAuthStore((s) => s.user);
  // const userRole  = user?.role || 'admin';

  const normalizeRole = (r) =>
    String(r || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_');

  const userRole = normalizeRole(user?.role) || 'admin';

  // Filter items by role; strip the roles key before passing to Ant Menu
  const menuItems = allMenuItems
    .filter((item) => item.roles?.includes(userRole))
    .map(({ roles, ...rest }, index) => {
      if (rest.type === 'divider') return { type: 'divider', key: `divider-${index}` };
      return rest;
    });
  // console.log('ROLE FROM STORE:', user?.role, 'NORMALIZED:', userRole);
  // console.log("MENU KEYS:", menuItems.map(i => i?.key || i?.type));
  // Highlight the current page.
  // Sort by key length descending so longer (more specific) paths match first.
  // Treat both '/' and '/dashboard' as the Dashboard item ('/dashboard').
  const currentPath = location.pathname === '/' ? '/dashboard' : location.pathname;
  const selectedKey =
    menuItems
      .filter((i) => i && i.type !== 'divider' && i.key)
      .sort((a, b) => (b.key?.length || 0) - (a.key?.length || 0))
      .find((item) =>
        currentPath === item.key ||
        (item.key !== '/dashboard' && currentPath.startsWith(item.key + '/'))
      )?.key || '/dashboard';

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
        background: ERP_COLORS.sidebar,
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
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="School Logo"
            style={{
              maxHeight: 34,
              maxWidth: collapsed ? 40 : 100,
              objectFit: 'contain',
              backgroundColor: 'transparent',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${ERP_COLORS.sidebarActive}, ${ERP_COLORS.primary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFF',
              fontWeight: 700,
              fontSize: 13,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            V
          </div>
        )}
        {!collapsed && (
          <span
            style={{
              color: '#F8FAFC',
              fontWeight: 600,
              fontSize: 16,
              marginLeft: 12,
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            VSS ERP
          </span>
        )}
      </div>

      {/* Navigation */}
      {/* Navigation */}
      <div
        style={{
          height: 'calc(100vh - 64px)', // 64 = header brand height
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingBottom: 50,
        }}
      >
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key === '/dashboard' ? '/dashboard' : key)}
          style={{
            borderRight: 'none',
            marginTop: 8,
            background: 'transparent',
          }}
        />
      </div>
    </Sider>
  );
};

export default Sidebar;
