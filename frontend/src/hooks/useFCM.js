import { useEffect, useRef } from 'react';
import { requestNotificationPermission, onForegroundMessage, showLocalNotification } from '@/utils/pwa';
import useAuthStore from '@/store/authStore';
import { notificationAPI } from '@/services/api';

const registeredTokenKeys = new Set();

/**
 * useFCM — hook that:
 * 1. Requests notification permission on mount (for authenticated users)
 * 2. Stores FCM token in localStorage
 * 3. Listens for foreground FCM messages and shows a local notification
 * 4. Accepts an optional onMessage callback for in-app toast updates
 *
 * Usage: call once at the layout level (ParentLayout / FacultyLayout)
 */
const useFCM = (onMessage = null) => {
  const user = useAuthStore((s) => s.user);
  const unsubRef = useRef(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const setup = async () => {
      // 1. Request permission + get token
      const token = await requestNotificationPermission();
      if (token) {
        const userId = user._id || user.id;
        const registrationKey = `${userId}:${token}`;
        if (!registeredTokenKeys.has(registrationKey)) {
          registeredTokenKeys.add(registrationKey);
          await notificationAPI.registerDeviceToken(token, 'web').catch((e) => {
            registeredTokenKeys.delete(registrationKey);
            console.warn('[useFCM] token registration failed:', e.message);
          });
        }
      }

      // 2. Listen for foreground messages
      unsubRef.current = await onForegroundMessage((payload) => {
        if (cancelled) return;

        const title   = payload.notification?.title || payload.data?.title || 'VMS School ERP';
        const body    = payload.notification?.body  || payload.data?.body  || payload.data?.message || '';
        const data    = payload.data || {};

        // Show OS notification while app is in foreground
        showLocalNotification(title, body, data);

        // Optional in-app callback (e.g. refresh notification list, show toast)
        if (typeof onMessageRef.current === 'function') {
          onMessageRef.current({ title, body, data, payload });
        }
      });
    };

    setup().catch((e) => console.warn('[useFCM] setup error:', e.message));

    return () => {
      cancelled = true;
      if (typeof unsubRef.current === 'function') {
        unsubRef.current();
      }
    };
  }, [user?._id, user?.id]);
};

export default useFCM;
