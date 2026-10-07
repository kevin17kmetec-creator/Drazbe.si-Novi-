import { useState, useEffect, useRef, useCallback } from 'react';
import { NotificationItem, getNotificationText } from '../components/layout/NotificationBell';
import { toast } from '../lib/toast';

export function useNotifications(user: any, onSelectNotification?: (item: NotificationItem) => void) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const initialLoadRef = useRef(true);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Polling-Funktion zum Abrufen der Benachrichtigungen
  const fetchNotifications = useCallback(async () => {
    if (!user || typeof document === 'undefined' || document.visibilityState !== 'visible') return;

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/notifications', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const list: NotificationItem[] = data.notifications || [];

      setNotifications(list);

      if (initialLoadRef.current) {
        // Erstes Laden: Verarbeitete IDs speichern ohne Toast
        list.forEach((n) => seenIdsRef.current.add(n.id));
        initialLoadRef.current = false;
      } else {
        // Neue Benachrichtigungen identifizieren
        const newNotifications = list.filter((n) => !seenIdsRef.current.has(n.id));
        // Max 3 Toasts auf einmal anzeigen
        const toShow = newNotifications.slice(0, 3);

        toShow.forEach((n) => {
          seenIdsRef.current.add(n.id);
          const shortText = getNotificationText(n.type, n.price);

          toast.info(shortText, {
            description: n.auction_title || 'Dražba',
            duration: 8000,
            action: {
              label: 'Odpri',
              onClick: () => {
                if (onSelectNotification) onSelectNotification(n);
              }
            }
          });
        });

        // Alle restlichen neuen IDs ebenfalls markieren
        newNotifications.forEach((n) => seenIdsRef.current.add(n.id));
      }
    } catch (err) {
      // Fehler stumm abfangen, um das Intervall nicht zu unterbrechen
    }
  }, [user, onSelectNotification]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      initialLoadRef.current = true;
      seenIdsRef.current.clear();
      return;
    }

    fetchNotifications();

    const interval = setInterval(() => {
      fetchNotifications();
    }, 20000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchNotifications]);

  const markRead = useCallback(async (id?: string, all?: boolean) => {
    if (!user) return;

    // Lokalen Zustand sofort optimistisch aktualisieren
    if (all) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } else if (id) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    }

    try {
      const token = await user.getIdToken();
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, all })
      });
    } catch (err) {
      // Server-Fehler beim Als-gelesen-Markieren ignorieren
    }
  }, [user]);

  return {
    notifications,
    markRead,
    refetch: fetchNotifications
  };
}
