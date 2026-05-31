import { useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';

export default function ChatbaseLoader() {
  const { user } = useAuthStore();

  useEffect(() => {
    // 1. Initialize Chatbase snippet if not already done
    if (!window.chatbase || window.chatbase("getState") !== "initialized") {
      console.log('[Chatbase] Initializing proxy...');
      window.chatbase = function() {
        if (!window.chatbase.q) {
          window.chatbase.q = [];
        }
        window.chatbase.q.push(arguments);
      };
      window.chatbase = new Proxy(window.chatbase, {
        get(target, prop) {
          if (prop === "q") {
            return target.q;
          }
          return (...args) => target(prop, ...args);
        }
      });
    }

    // 2. Load script with bubble hidden
    const chatbotId = "bEmT4yEDV8-c9PK1KEFa0";
    if (!document.getElementById(chatbotId)) {
      console.log('[Chatbase] Loading hidden embed script for ID:', chatbotId);
      const script = document.createElement("script");
      script.src = "https://www.chatbase.co/embed.min.js";
      script.id = chatbotId;
      script.domain = "www.chatbase.co";
      script.defer = true;
      
      // These attributes often help hide the bubble depending on the platform config
      // but the most reliable way is often using the window.chatbase API
      document.body.appendChild(script);
      
      // Attempt to hide the bubble immediately after initialization
      window.chatbase('config', {
        showBubble: false, // Standard Chatbase config to hide the floating icon
      });
    }

    // 3. Identify user when session is available
    if (user && window.electron?.chatbase?.getToken) {
      const identifyUser = async () => {
        try {
          console.log('[Chatbase] Fetching identity token for:', user.email);
          const { token, error } = await window.electron.chatbase.getToken({
            id: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || 'User'
          });

          if (token) {
            console.log('[Chatbase] Identifying user...');
            window.chatbase('identify', { token });
          } else {
            console.warn('[Chatbase] Identity skipped (no token):', error);
          }
        } catch (err) {
          console.error('[Chatbase] Identity error:', err);
        }
      };

      identifyUser();
    }
  }, [user]);

  return null;
}
