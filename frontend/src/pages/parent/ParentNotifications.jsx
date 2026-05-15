import React, { useEffect, useState, useCallback, useMemo } from 'react';
import ParentLayout from '@/components/mobile/ParentLayout';
import { notificationAPI } from '@/services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const TYPE_CONFIG = {
  info:    { icon: 'ℹ️',  bg: 'var(--color-primary-light)', color: 'var(--color-primary)', label: 'Info'    },
  success: { icon: '✅',  bg: '#DCFCE7', color: '#16A34A', label: 'Success' },
  warning: { icon: '⚠️', bg: '#FEF3C7', color: '#D97706', label: 'Warning' },
  error:   { icon: '🚨', bg: '#FEE2E2', color: '#DC2626', label: 'Alert'   },
};

const CONTENT_ICON = { image: '🖼️', file: '📎', link: '🔗', text: '💬', video: '🎥' };

const FILTER_TYPES = [
  { value: '',      label: 'All'   },
  { value: 'text',  label: '💬 Text'  },
  { value: 'image', label: '🖼️ Image' },
  { value: 'file',  label: '📎 File'  },
  { value: 'link',  label: '🔗 Link'  },
];

const ParentNotifications = () => {
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(true);
  const [marking,       setMarking]       = useState(false);
  const [expanded,      setExpanded]      = useState(null);

  // ── Filters ──────────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [filterType,  setFilterType]  = useState('');  // contentType
  const [showUnread,  setShowUnread]  = useState(false);

  const loadNotifs = useCallback(async (p = 1, reset = false) => {
    if (p === 1 || reset) setLoading(true);
    setError(null);
    try {
      const res   = await notificationAPI.getAll({ page: p, limit: 20 });
      const items = res?.data?.notifications || res?.data || [];
      if (p === 1 || reset) {
        setNotifications(items);
      } else {
        setNotifications((prev) => [...prev, ...items]);
      }
      setHasMore(items.length === 20);
    } catch (e) {
      setError(e.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNotifs(1); }, [loadNotifs]);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await notificationAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } finally { setMarking(false); }
  };

  const markRead = async (notif) => {
    if (notif.isRead) return;
    try {
      await notificationAPI.markRead(notif._id);
      setNotifications((prev) =>
        prev.map((n) => n._id === notif._id ? { ...n, isRead: true } : n)
      );
    } catch {}
  };

  const handleExpand = (notif) => {
    setExpanded(expanded === notif._id ? null : notif._id);
    markRead(notif);
  };

  // ── Client-side filtering ────────────────────────────────
  const filtered = useMemo(() => {
    let list = notifications;
    if (showUnread)  list = list.filter((n) => !n.isRead);
    if (filterType)  list = list.filter((n) => n.contentType === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) =>
        n.title?.toLowerCase().includes(q) ||
        n.message?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [notifications, showUnread, filterType, search]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <ParentLayout
      title="Notifications"
      subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
    >

      {/* ── Toolbar ── */}
      <div className="m-card" style={{ padding: '12px 14px', marginBottom: 10 }}>

        {/* Search */}
        <div className="m-form-group" style={{ marginBottom: 10 }}>
          <input
            className="m-input"
            placeholder="🔍 Search by title or message..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Content Type Pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {FILTER_TYPES.map((ft) => (
            <button
              key={ft.value}
              onClick={() => setFilterType(ft.value)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: 'none', cursor: 'pointer',
                background: filterType === ft.value ? 'var(--color-primary-dark)' : '#F1F5F9',
                color:      filterType === ft.value ? '#fff'    : '#64748B',
                transition: 'all 0.15s',
              }}
            >
              {ft.label}
            </button>
          ))}
        </div>

        {/* Unread toggle + Mark all */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowUnread(!showUnread)}
            style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: `1.5px solid ${showUnread ? 'var(--color-primary)' : '#E2E8F0'}`,
              background: showUnread ? 'var(--color-primary-light)' : 'transparent',
              color: showUnread ? 'var(--color-primary)' : '#64748B',
              cursor: 'pointer', flex: 1,
            }}
          >
            {showUnread ? '🔵 Unread only' : '○ Show all'}
          </button>
          {unreadCount > 0 && (
            <button
              className="m-btn m-btn-ghost"
              style={{ flex: 1, padding: '7px', fontSize: 12 }}
              onClick={markAllRead}
              disabled={marking}
            >
              {marking ? '...' : '✓ Mark all read'}
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '10px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{notifications.length}</div>
          <div style={{ fontSize: 10, color: '#64748B' }}>Total</div>
        </div>
        <div style={{ flex: 1, background: 'var(--color-primary-light)', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)' }}>{unreadCount}</div>
          <div style={{ fontSize: 10, color: 'var(--color-primary)' }}>Unread</div>
        </div>
        <div style={{ flex: 1, background: '#F0FDF4', borderRadius: 10, padding: '10px', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#16A34A' }}>{filtered.length}</div>
          <div style={{ fontSize: 10, color: '#16A34A' }}>Filtered</div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="m-card" style={{ borderLeft: '3px solid #EF4444', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#DC2626', marginBottom: 8 }}>{error}</div>
          <button className="m-btn m-btn-outline" onClick={() => loadNotifs(1)}>Retry</button>
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="m-spinner" />
      ) : filtered.length === 0 ? (
        <div className="m-empty">
          <div className="m-empty-icon">🔔</div>
          <div className="m-empty-text">
            {search || filterType || showUnread
              ? 'No notifications match your filters'
              : 'No notifications yet'}
          </div>
          {(search || filterType || showUnread) && (
            <button
              className="m-btn m-btn-ghost"
              style={{ marginTop: 12, width: 'auto', padding: '8px 20px' }}
              onClick={() => { setSearch(''); setFilterType(''); setShowUnread(false); }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {filtered.map((n) => {
            const tc    = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            const isOpen = expanded === n._id;
            return (
              <div
                key={n._id}
                className={`m-notif-item${!n.isRead ? ' unread' : ''}`}
                onClick={() => handleExpand(n)}
                style={{ flexDirection: 'column', gap: 8, cursor: 'pointer' }}
              >
                {/* Top Row */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, background: tc.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {CONTENT_ICON[n.contentType] || tc.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <div className="m-notif-title" style={{ flex: 1 }}>{n.title}</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                        {n.contentType && n.contentType !== 'text' && (
                          <span style={{
                            fontSize: 9, padding: '2px 6px', borderRadius: 10,
                            background: '#F1F5F9', color: '#64748B', fontWeight: 600,
                          }}>
                            {n.contentType.toUpperCase()}
                          </span>
                        )}
                        {!n.isRead && (
                          <div style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--color-primary)', marginTop: 3 }} />
                        )}
                      </div>
                    </div>
                    <div
                      className="m-notif-body"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: isOpen ? 'unset' : 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: isOpen ? 'visible' : 'hidden',
                      }}
                    >
                      {n.message}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                      <span className="m-notif-time">{dayjs(n.createdAt).fromNow()}</span>
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 10,
                        background: tc.bg, color: tc.color, fontWeight: 600,
                      }}>
                        {tc.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rich Media (expanded) */}
                {isOpen && n.contentUrl && (
                  <>
                    {n.contentType === 'image' && (
                      <img
                        src={n.contentUrl}
                        alt="notification media"
                        style={{ width: '100%', borderRadius: 10, maxHeight: 240, objectFit: 'cover' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    {(n.contentType === 'file' || n.contentType === 'link' || n.contentType === 'video') && (
                      <a
                        href={n.contentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="m-btn m-btn-outline"
                        style={{ fontSize: 12, padding: '8px 14px', textDecoration: 'none' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {CONTENT_ICON[n.contentType]} {
                          n.contentType === 'file'  ? 'Open Attachment' :
                          n.contentType === 'video' ? 'Watch Video'     : 'Open Link'
                        }
                      </a>
                    )}
                  </>
                )}

                {/* Expand hint */}
                {!isOpen && (n.contentUrl || n.message?.length > 80) && (
                  <div style={{ fontSize: 11, color: '#94A3B8', alignSelf: 'flex-end' }}>
                    Tap to expand ↓
                  </div>
                )}
              </div>
            );
          })}

          {/* Load more — only when no active search/filter (server pagination) */}
          {!search && !filterType && !showUnread && hasMore && (
            <button
              className="m-btn m-btn-ghost"
              style={{ marginTop: 8 }}
              onClick={() => {
                const np = page + 1;
                setPage(np);
                loadNotifs(np);
              }}
            >
              Load more
            </button>
          )}
        </>
      )}
    </ParentLayout>
  );
};

export default ParentNotifications;
