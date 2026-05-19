/* =========================================================
   VSS ERP — Theme Tokens (Stable)
   Deep Orange as PRIMARY, Neutral UI, Dark Sidebar
   ========================================================= */

export const ERP_COLORS = {
  // Brand (deep orange)
  primary: '#C2410C',
  primaryHover: '#EA580C',
  primaryActive: '#9A3412',
  primarySoft: '#FFF7ED',
  primaryLight: '#FFEDD5',
  primaryBorder: '#FDBA74',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',

  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textSoft: '#94A3B8',

  border: '#E2E8F0',
  borderSoft: '#F1F5F9',

  // Layout (KEEP NEUTRAL — this fixes the “transparent/washed” feel)
  layout: '#F8FAFC',
  card: '#FFFFFF',
  headerBg: '#FFFFFF',

  // Sidebar (KEEP DARK — do NOT make sidebar orange)
  sidebar: '#0B1220',
  sidebarHover: '#111827',
  sidebarActive: '#1F2937',
  sidebarText: '#FFFFFF',
  sidebarTextMuted: 'rgba(255,255,255,0.70)',

  // Table
  tableHeaderBg: '#F1F5F9',
  tableHeaderText: '#334155',
  tableRowHover: '#F8FAFC',

  // Inputs
  inputBg: '#FFFFFF',
  inputBorder: '#CBD5E1',
  inputBorderHover: '#FDBA74',
  inputBorderFocus: '#EA580C',

  // Status
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#0EA5E9', // keep as info (not theme primary)

  // Shadows
  shadowSm: '0 2px 6px rgba(15,23,42,0.06)',
  shadowMd: '0 10px 24px rgba(15,23,42,0.10)',
};

export const COLORS = ERP_COLORS; // backward compatibility

export const TOKEN = {
  colorPrimary: ERP_COLORS.primary,
  colorPrimaryHover: ERP_COLORS.primaryHover,
  colorPrimaryActive: ERP_COLORS.primaryActive,

  colorSuccess: ERP_COLORS.success,
  colorWarning: ERP_COLORS.warning,
  colorError: ERP_COLORS.error,
  colorInfo: ERP_COLORS.info,

  colorText: ERP_COLORS.text,
  colorTextSecondary: ERP_COLORS.textSecondary,
  colorTextTertiary: ERP_COLORS.textMuted,

  colorBgLayout: ERP_COLORS.layout,
  colorBgContainer: ERP_COLORS.card,

  colorBorder: ERP_COLORS.border,
  colorSplit: ERP_COLORS.borderSoft,

  borderRadius: 8,
  fontSize: 14,
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export const THEME = {
  token: TOKEN,
  components: {
    Layout: {
      siderBg: ERP_COLORS.sidebar,
      headerBg: ERP_COLORS.headerBg,
      bodyBg: ERP_COLORS.layout,
    },
    Menu: {
      darkItemBg: ERP_COLORS.sidebar,
      darkItemColor: ERP_COLORS.sidebarTextMuted,
      darkItemHoverBg: ERP_COLORS.sidebarHover,
      darkItemSelectedBg: ERP_COLORS.primary,          // orange active
      darkItemSelectedColor: ERP_COLORS.sidebarText,
    },
    Table: {
      headerBg: ERP_COLORS.tableHeaderBg,
      headerColor: ERP_COLORS.tableHeaderText,
      rowHoverBg: ERP_COLORS.tableRowHover,
      borderColor: ERP_COLORS.border,
    },
    Button: {
      colorPrimary: ERP_COLORS.primary,
      colorPrimaryHover: ERP_COLORS.primaryHover,
      colorPrimaryActive: ERP_COLORS.primaryActive,
      borderRadius: 8,
    },
    Input: {
      colorBgContainer: ERP_COLORS.inputBg,
      colorBorder: ERP_COLORS.inputBorder,
      hoverBorderColor: ERP_COLORS.inputBorderHover,
      activeBorderColor: ERP_COLORS.inputBorderFocus,
    },
    Select: {
      colorBgContainer: ERP_COLORS.inputBg,
      colorBorder: ERP_COLORS.inputBorder,
      optionSelectedBg: ERP_COLORS.primarySoft,
    },
    Tabs: {
      itemSelectedColor: ERP_COLORS.primary,
      inkBarColor: ERP_COLORS.primary,
    },
    Pagination: { colorPrimary: ERP_COLORS.primary },
  },
};

export const applyERPTheme = () => {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--erp-primary', ERP_COLORS.primary);
  document.documentElement.style.setProperty('--erp-bg', ERP_COLORS.layout);
  document.documentElement.style.setProperty('--erp-sidebar', ERP_COLORS.sidebar);
};

export default ERP_COLORS;
