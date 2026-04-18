import OneSignal from 'onesignal-cordova-plugin';
import { Capacitor } from '@capacitor/core';

export const setupOneSignal = async (userId: string) => {
  // Push notifications only work on real mobile devices (Android/iOS)
  if (!Capacitor.isNativePlatform()) return;

  // 1. PASTE YOUR APP ID RIGHT HERE 👇
  OneSignal.initialize("48b24eb5-4ba2-4e35-bbcc-bd4f69f4bc7b"); 

  // 2. Request Permission from the user
  OneSignal.Notifications.requestPermission(true).then((accepted: boolean) => {
    console.log("User accepted notifications:", accepted);
  });

  // 3. Link the device to the user's Supabase ID
  OneSignal.login(userId);

  // 4. Handle what happens when a user taps the notification
  OneSignal.Notifications.addEventListener('click', (event) => {
    const notificationData = event.notification.additionalData as any;
    if (notificationData && notificationData.chatId) {
      // Example: Redirect to the specific chat
      // window.location.href = `/messages?chat=${notificationData.chatId}`;
    }
  });
};