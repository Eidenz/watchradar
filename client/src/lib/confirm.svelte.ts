export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Ask for a text/password value; resolves with the string (or null when cancelled). */
  input?: { label: string; type?: 'text' | 'password'; placeholder?: string };
}

class ConfirmStore {
  current = $state<(ConfirmOptions & { resolve: (v: any) => void }) | null>(null);

  ask(opts: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => (this.current = { ...opts, resolve }));
  }
  prompt(opts: ConfirmOptions & { input: NonNullable<ConfirmOptions['input']> }): Promise<string | null> {
    return new Promise((resolve) => (this.current = { ...opts, resolve }));
  }
  settle(v: any) {
    this.current?.resolve(v);
    this.current = null;
  }
}

export const confirm = new ConfirmStore();
