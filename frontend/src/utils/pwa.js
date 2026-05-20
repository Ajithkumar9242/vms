/**
 * Firebase FCM integration for VMS ERP mobile PWA.
 *
 * HOW TO CONFIGURE:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Add a Web App → copy the firebaseConfig object
 * 3. Set these env vars in frontend/.env:
 *    VITE_FIREBASE_API_KEY=...
 *    VITE_FIREBASE_AUTH_DOMAIN=...
 *    VITE_FIREBASE_PROJECT_ID=...
 *    VITE_FIREBASE_MESSAGING_SENDER_ID=...
 *    VITE_FIREBASE_APP_ID=...
 *    VITE_FIREBASE_VAPID_KEY=...   (from Project Settings → Cloud Messaging)
 */

// ─── Firebase config from env ────────────────────────────────
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// ─── Lazy-load Firebase modules only when configured ─────────
let _app = null;
let _messaging = null;

const isFirebaseConfigured = () =>
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId;

const initFirebase = async () => {
  if (_messaging) return _messaging;
  if (!isFirebaseConfigured()) {
    console.info('[FCM] Firebase env vars not set — push notifications disabled.');
    return null;
  }
  try {
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

    if (!getApps().length) {
      _app = initializeApp(firebaseConfig);
    } else {
      _app = getApps()[0];
    }

    _messaging = getMessaging(_app);
    return _messaging;
  } catch (e) {
    console.error('[FCM] Firebase init failed:', e.message);
    return null;
  }
};

// ─── Register SW and post Firebase config to it ──────────────
export const registerSW = async () => {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    // console.log('[PWA] Service Worker registered:', reg.scope);

    // Post Firebase config to SW for background message handling
    if (isFirebaseConfigured() && reg.active) {
      reg.active.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
    }
    // Also post once SW is ready
    navigator.serviceWorker.ready.then((r) => {
      r.active?.postMessage({ type: 'FIREBASE_CONFIG', config: firebaseConfig });
    });

    return reg;
  } catch (err) {
    console.error('[PWA] Service Worker registration failed:', err);
  }
};

// ─── Request notification permission + get FCM token ─────────
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return null;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    console.info('[FCM] Notification permission denied.');
    return null;
  }

  const messaging = await initFirebase();
  if (!messaging || !VAPID_KEY) return null;

  try {
    const { getToken } = await import('firebase/messaging');
    const swReg = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (token) {
      // console.log('[FCM] Token obtained:', token.substring(0, 20) + '...');
      // Persist token for the session; backend integration is opt-in
      localStorage.setItem('vms_fcm_token', token);
      return token;
    }
  } catch (e) {
    console.error('[FCM] getToken failed:', e.message);
  }
  return null;
};

// ─── Listen for foreground messages ──────────────────────────
export const onForegroundMessage = async (callback) => {
  const messaging = await initFirebase();
  if (!messaging) return () => { };

  try {
    const { onMessage } = await import('firebase/messaging');
    return onMessage(messaging, (payload) => {
      // console.log('[FCM] Foreground message:', payload);
      callback(payload);
    });
  } catch (e) {
    console.error('[FCM] onMessage failed:', e.message);
    return () => { };
  }
};

// ─── Show a local browser notification ───────────────────────
export const showLocalNotification = (title, body, data = {}) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  navigator.serviceWorker.ready.then((reg) => {
    reg.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: '/', ...data },
    });
  });
};

// ─── Legacy alias (backward compat) ──────────────────────────
export const sendLocalNotification = showLocalNotification;
