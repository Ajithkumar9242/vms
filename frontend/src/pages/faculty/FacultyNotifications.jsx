import React, { useEffect, useState, useCallback } from 'react';
import FacultyLayout from '@/components/mobile/FacultyLayout';
import { notificationAPI } from '@/services/api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
dayjs.extend(relativeTime);

const TYPE_CONFIG = {
  info:    { icon: 'ℹ️', bg: '#DBEAFE', color: '#2563EB' },
  success: { icon: '✅', bg: '#DCFCE7', color: '#16A34A' },
  warning: { icon: '⚠️', bg: '#FEF3C7', color: '#D97706' },
  error:   { icon: '🚨', bg: '#FEE2E2', color: '#DC2626' },
};

const FacultyNotifications = () => {
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [marking, setMarking] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const loadNotifs = useCallback(async (p = 1) => {
    if (p === 1) setLoading(true);
    try {
      const res = await notificationAPI.getAll({ page: p, limit: 20 });
      const items = res?.data?.notifications || res?.data || [];
      if (p === 1) setNotifications(items);
      else setNotifications((prev) => [...prev, ...items]);
      setHasMore(items.length === 20);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadNotifs(1); }, [loadNotifs]);

  const markAllRead = async () => {
    setMarking(true);
    try {
      await notificationAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } finally { setMarking(false); }
  };

  const handleExpand = async (notif) => {
    setExpanded(expanded === notif._id ? null : notif._id);
    if (!notif.isRead) {
      try {
        await notificationAPI.markRead(notif._id);
        setNotifications((prev) => prev.map((n) => n._id === notif._id ? { ...n, isRead: true } : n));
      } catch {}
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <FacultyLayout title="Notifications" subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All read'}>
      {unreadCount > 0 && (
        <button className="m-btn m-btn-ghost" style={{ marginBottom: 12, fontSize: 13 }}
          onClick={markAllRead} disabled={marking}>
          {marking ? 'Marking...' : '✓ Mark all as read'}
        </button>
      )}

      {loading ? <div className="m-spinner" /> : notifications.length === 0 ? (
        <div className="m-empty">
          <div className="m-empty-icon">🔔</div>
          <div className="m-empty-text">No notifications yet</div>
        </div>
      ) : (
        <>
          {notifications.map((n) => {
            const tc = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            const isOpen = expanded === n._id;
            return (
              <div key={n._id} className={`m-notif-item${!n.isRead ? ' unread' : ''}`}
                onClick={() => handleExpand(n)} style={{ flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', width: '100%' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {tc.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div className="m-notif-title">{n.title}</div>
                      {!n.isRead && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#2563EB', flexShrink: 0, marginTop: 4 }} />}
                    </div>
                    <div className="m-notif-body" style={{
                      display: '-webkit-box', WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: isOpen ? 'unset' : 2,
                      overflow: isOpen ? 'visible' : 'hidden',
                    }}>{n.message}</div>
                    <div className="m-notif-time">{dayjs(n.createdAt).fromNow()}</div>
                  </div>
                </div>
                {isOpen && n.contentUrl && n.contentType === 'image' && (
                  <img src={n.contentUrl} alt="" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover' }} />
                )}
                {isOpen && n.contentUrl && (n.contentType === 'file' || n.contentType === 'link') && (
                  <a href={n.contentUrl} target="_blank" rel="noreferrer"
                    className="m-btn m-btn-outline" style={{ fontSize: 12, padding: '8px 14px' }}
                    onClick={(e) => e.stopPropagation()}>
                    {n.contentType === 'file' ? '📎 Open File' : '🔗 Open Link'}
                  </a>
                )}
              </div>
            );
          })}
          {hasMore && (
            <button className="m-btn m-btn-ghost" style={{ marginTop: 8 }}
              onClick={() => { const np = page + 1; setPage(np); loadNotifs(np); }}>
              Load more
            </button>
          )}
        </>
      )}
    </FacultyLayout>
  );
};

export default FacultyNotifications;
