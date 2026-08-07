// public/firebase-messaging-sw.js
// ---------------------------------------------------------------------------
// Service Worker for Firebase Cloud Messaging.
// Place this file in your project's /public folder so it is served from the
// site root: https://yourdomain.com/firebase-messaging-sw.js
// FCM auto-registers this worker by name — do NOT rename it.
// ---------------------------------------------------------------------------

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// 🔧 Paste the SAME firebaseConfig object from your firebase-applet-config.json
const firebaseConfig = {
  apiKey: 'AIzaSyCBTwQPFepzSP4E5EuzaJd5lVdbwP4-vzk',
  authDomain: 'gen-lang-client-0521821891.firebaseapp.com',
  projectId: 'gen-lang-client-0521821891',
  storageBucket: 'gen-lang-client-0521821891.firebasestorage.app',
  messagingSenderId: '1044529165902',
  appId: '1:1044529165902:web:28169ad04d7bf6beebf51f'
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Background / push event: required so notifications land in the phone's
// notification bar when the app is closed or in the background.
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'THE APEX WORLD', {
    body: body || '',
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [120, 60, 120],
    tag: 'apex-push'
  });
});

// Open the app when the user taps the notification.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow('/');
    })
  );
});
