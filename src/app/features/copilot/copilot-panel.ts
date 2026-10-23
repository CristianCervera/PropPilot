import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TPipe } from '../../core/i18n';
import { Icon } from '../../shared/icon';
import { CopilotChat } from './copilot-chat';
import { CopilotStore } from './copilot.store';

/** Slide-over copilot available from every screen (⌘K / Ctrl+K). */
@Component({
  selector: 'app-copilot-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, CopilotChat, TPipe],
  template: `
    @if (store.panelOpen()) {
      <div class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden" (click)="store.panelOpen.set(false)"></div>
      <aside
        class="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--line)] bg-ink-900/95 shadow-[-30px_0_80px_-30px_rgb(139_92_246/0.45)] backdrop-blur-xl animate-fade-up sm:w-[440px]"
        [attr.aria-label]="'title.copilot' | t"
      >
        <header class="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
          <app-icon name="sparkles" class="text-violet-soft" />
          <h2 class="h-display flex-1 font-semibold"><span class="ai-text">PropPilot</span> Copilot</h2>
          <button class="btn btn-ghost btn-sm btn-icon" [title]="'chat.newConversation' | t" (click)="store.newChat()" [attr.aria-label]="'chat.newConversation' | t">
            <app-icon name="plus" [size]="16" />
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" [title]="'chat.fullscreen' | t" (click)="expand()" [attr.aria-label]="'chat.fullscreen' | t">
            <app-icon name="expand" [size]="15" />
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" (click)="store.panelOpen.set(false)" [attr.aria-label]="'chat.closeCopilot' | t">
            <app-icon name="x" [size]="16" />
          </button>
        </header>
        <app-copilot-chat [autofocus]="true" />
      </aside>
    }
  `,
})
export class CopilotPanel {
  protected readonly store = inject(CopilotStore);
  private readonly router = inject(Router);

  expand() {
    this.store.panelOpen.set(false);
    void this.router.navigateByUrl('/copilot');
  }
}
