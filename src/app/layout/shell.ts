import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { Auth } from '../core/auth';
import { TKey, TPipe } from '../core/i18n';
import { Api } from '../core/api';
import { CopilotPanel } from '../features/copilot/copilot-panel';
import { CopilotStore } from '../features/copilot/copilot.store';
import { Icon } from '../shared/icon';
import { LangSwitch } from '../shared/lang-switch';
import { ThemeSwitch } from '../shared/theme-switch';

const NAV: { path: string; icon: string; label: TKey; exact: boolean }[] = [
  { path: '/', icon: 'dashboard', label: 'title.home', exact: true },
  { path: '/properties', icon: 'building', label: 'title.properties', exact: false },
  { path: '/clients', icon: 'users', label: 'title.clients', exact: false },
  { path: '/agenda', icon: 'calendar', label: 'title.agenda', exact: false },
  { path: '/copilot', icon: 'sparkles', label: 'title.copilot', exact: false },
];

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, CopilotPanel, LangSwitch, ThemeSwitch, TPipe],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <div class="flex min-h-dvh">
      <!-- Sidebar -->
      <aside
        class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--line)] bg-ink-900/90 backdrop-blur-xl transition-transform lg:translate-x-0"
        [class.-translate-x-full]="!menuOpen()"
      >
        <a routerLink="/" class="flex items-center gap-3 px-5 pt-5 pb-6" (click)="menuOpen.set(false)">
          <img src="logo.webp" alt="" class="size-10 rounded-xl shadow-[0_6px_24px_-6px_rgb(192_79_216/0.8)]" />
          <span>
            <span class="h-display block text-lg font-bold leading-none">PropPilot</span>
            <span class="text-[11px] text-faint">{{ 'shell.tagline' | t }}</span>
          </span>
        </a>
        <nav class="flex-1 space-y-1 px-3">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="!bg-tint/[0.07] !text-fg nav-active"
              [routerLinkActiveOptions]="{ exact: item.exact }"
              class="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-tint/[0.04] hover:text-fg"
              (click)="menuOpen.set(false)"
            >
              <app-icon [name]="item.icon" [class]="item.icon === 'sparkles' ? 'text-violet-soft' : ''" />
              {{ item.label | t }}
            </a>
          }
        </nav>

        <div class="m-3 rounded-xl border border-[var(--line)] bg-tint/[0.02] p-3">
          <div class="flex items-center gap-2 text-xs">
            <span class="size-2 rounded-full" [class]="aiOnline() ? 'bg-ok shadow-[0_0_10px] shadow-ok' : 'bg-warn'"></span>
            <span class="flex-1 text-muted">{{ (aiOnline() ? 'shell.aiOn' : 'shell.aiOff') | t }}</span>
            <app-lang-switch />
            <app-theme-switch />
          </div>
          @if (!aiOnline()) {
            <p class="mt-1.5 text-[11px] leading-snug text-faint">{{ 'shell.aiHint' | t }}</p>
          }
        </div>

        <div class="flex items-center gap-3 border-t border-[var(--line)] px-4 py-3.5">
          <span class="grid size-9 place-items-center rounded-full bg-[image:var(--grad-ai)] text-sm font-bold text-white">{{ initials() }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ auth.user()?.name }}</p>
            <p class="truncate text-[11px] text-faint">{{ auth.user()?.email }}</p>
          </div>
          <button class="btn btn-ghost btn-sm btn-icon" (click)="auth.logout()" [title]="'shell.logout' | t" [attr.aria-label]="'shell.logout' | t">
            <app-icon name="logout" [size]="15" />
          </button>
        </div>
      </aside>
      @if (menuOpen()) {
        <div class="fixed inset-0 z-30 bg-black/50 lg:hidden" (click)="menuOpen.set(false)"></div>
      }

      <!-- Main -->
      <div class="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[var(--line)] bg-ink-950/70 px-4 backdrop-blur-xl sm:px-6">
          <button class="btn btn-ghost btn-icon lg:hidden" (click)="menuOpen.set(true)" [attr.aria-label]="'shell.openMenu' | t">
            <app-icon name="menu" />
          </button>
          <button
            class="group flex h-10 max-w-xl min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--line)] bg-tint/[0.03] px-3.5 text-left text-sm text-faint transition hover:border-[var(--line-strong)] hover:text-muted"
            (click)="copilot.open()"
          >
            <app-icon name="sparkles" class="text-violet-soft" [size]="16" />
            <span class="flex-1 truncate">{{ 'shell.askCopilot' | t }}</span>
            <kbd class="hidden rounded-md border border-[var(--line)] px-1.5 py-0.5 text-[10px] font-semibold sm:inline">Ctrl K</kbd>
          </button>
          <div class="hidden flex-1 sm:block"></div>
          <a routerLink="/properties/new" class="btn btn-primary hidden sm:inline-flex">
            <app-icon name="plus" [size]="16" /> {{ 'title.newProperty' | t }}
          </a>
        </header>
        <main class="mx-auto w-full max-w-[1500px] flex-1 px-4 py-5 sm:px-6 lg:py-7" [class.lg:pr-[464px]]="copilot.panelOpen() && !onCopilotPage()">
          <router-outlet />
        </main>
      </div>
    </div>
    <app-copilot-panel />
  `,
  styles: `
    :host ::ng-deep .nav-active::before {
      content: '';
      position: absolute;
      left: -0.75rem;
      top: 0.55rem;
      bottom: 0.55rem;
      width: 3px;
      border-radius: 0 4px 4px 0;
      background: var(--grad-ai);
    }
  `,
})
export class Shell {
  protected readonly auth = inject(Auth);
  protected readonly copilot = inject(CopilotStore);
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  protected readonly nav = NAV;
  protected readonly menuOpen = signal(false);
  protected readonly aiOnline = signal(true);
  protected readonly onCopilotPage = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/copilot')),
    ),
    { initialValue: this.router.url.startsWith('/copilot') },
  );

  constructor() {
    this.api
      .health()
      .then((h) => this.aiOnline.set(h.ai))
      .catch(() => this.aiOnline.set(false));
  }

  protected initials() {
    return (this.auth.user()?.name ?? '?')
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  onKey(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.copilot.panelOpen.update((open) => !open);
    }
  }
}
