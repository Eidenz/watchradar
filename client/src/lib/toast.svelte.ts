export type ToastType = 'success' | 'error' | 'info';
export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  action?: { label: string; run: () => void };
}

let n = 0;

class ToastStore {
  items = $state<ToastItem[]>([]);

  push(type: ToastType, message: string, action?: ToastItem['action']) {
    const id = ++n;
    this.items = [...this.items, { id, type, message, action }];
    setTimeout(() => this.dismiss(id), type === 'error' ? 5000 : action ? 5000 : 3000);
    return id;
  }
  dismiss(id: number) {
    this.items = this.items.filter((t) => t.id !== id);
  }
  success = (m: string, action?: ToastItem['action']) => this.push('success', m, action);
  error = (m: string) => this.push('error', m);
  info = (m: string, action?: ToastItem['action']) => this.push('info', m, action);
}

export const toast = new ToastStore();
