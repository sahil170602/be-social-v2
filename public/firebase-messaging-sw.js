importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "YOUR_API_KEY",
  authDomain: "besocial-user-app.firebaseapp.com",
  projectId: "besocial-user-app",
  storageBucket: "besocial-user-app.firebasestorage.app",
  messagingSenderId: "500106675461",
  appId: "1:500106675461:web:9e201915971f1b5f56e36c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png' // make sure this icon exists in public
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});