import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';
import { TPipe } from '../core/i18n';
import { Icon } from './icon';

interface Toast {
  id: number;
  kind: 'ok' | 'error' | 'ai';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly items = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, kind: Toast['kind'] = 'ok') {
    const id = ++this.seq;
    this.items.update((list) => [...list, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), kind === 'error' ? 6000 : 3500);
  }
  error = (text: string) => this.show(text, 'error');
  dismiss(id: number) {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}

@Component({
  selector: 'app-toaster',
  imports: [Icon, TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
      @for (t of toasts.items(); track t.id) {
        <div
          class="panel animate-fade-up pointer-events-auto flex items-start gap-3 px-4 py-3 text-sm shadow-2xl"
          [class.ai-surface]="t.kind === 'ai'"
          role="status"
        >
          <app-icon
            [name]="t.kind === 'error' ? 'alert' : t.kind === 'ai' ? 'sparkles' : 'check'"
            [class]="t.kind === 'error' ? 'text-bad' : t.kind === 'ai' ? 'text-violet-soft' : 'text-ok'"
          />
          <p class="flex-1 leading-snug">{{ t.text }}</p>
          <button class="text-faint hover:text-fg" (click)="toasts.dismiss(t.id)" [attr.aria-label]="'common.close' | t">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class Toaster {
  protected readonly toasts = inject(Toasts);
}
