import { api, setUnauthorizedHandler, type Me, type User } from './api';
import { router } from './router.svelte';

class Auth {
  user = $state<User | null>(null);
  unread = $state(0);
  pendingRequests = $state(0);
  registrationOpen = $state(true);
  ready = $state(false);

  constructor() {
    setUnauthorizedHandler(() => {
      if (this.user) {
        this.user = null;
        router.go(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      }
    });
  }

  apply(me: Me) {
    this.user = me.user;
    this.unread = me.unread_notifications;
    this.pendingRequests = me.pending_requests;
    this.registrationOpen = me.registration_open;
  }

  async load() {
    try {
      this.apply(await api.auth.me());
    } catch {
      this.user = null;
    } finally {
      this.ready = true;
    }
  }

  async refreshCounts() {
    if (!this.user) return;
    try {
      this.apply(await api.auth.me());
    } catch {
      /* ignore */
    }
  }

  async logout() {
    try {
      await api.auth.logout();
    } finally {
      this.user = null;
      router.go('/login');
    }
  }

  get titleLanguage() {
    return this.user?.title_language ?? 'en';
  }
}

export const auth = new Auth();
