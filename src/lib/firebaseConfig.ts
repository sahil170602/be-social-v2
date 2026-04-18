import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from "./supabaseClient";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const messaging = getMessaging(app);

/**
 * Request Notification Permission and Sync Token to Supabase
 */
export const requestNotificationPermission = async (userId: string) => {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      // Uses the VAPID key from your .env file
      const token = await getToken(messaging, { 
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY 
      });

      if (token) {
        console.log("FCM Token Generated:", token);
        
        // Update user profile in Supabase with the new token
        const { error } = await supabase
          .from('user_profiles')
          .update({ fcm_token: token })
          .eq('id', userId);

        if (error) console.error("Supabase Token Sync Error:", error.message);
      }
    } else {
      console.warn("Notification permission denied.");
    }
  } catch (err) {
    console.error("FCM Setup Error:", err);
  }
};

/**
 * Foreground message handler
 */
onMessage(messaging, (payload) => {
  console.log("Foreground message:", payload);
  if (payload.notification) {
    // You can replace this alert with a custom Toast UI later
    alert(`${payload.notification.title}\n${payload.notification.body}`);
  }
});