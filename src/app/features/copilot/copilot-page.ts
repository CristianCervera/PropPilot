import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DatePipeI18n, TPipe } from '../../core/i18n';
import { Icon } from '../../shared/icon';
import { CopilotChat } from './copilot-chat';
import { CopilotStore } from './copilot.store';

@Component({
  selector: 'app-copilot-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, CopilotChat, DatePipeI18n, TPipe],
  template: `
    <div class="flex h-[calc(100dvh-4rem)] gap-4 lg:h-[calc(100dvh-5.5rem)]">
      <aside class="panel hidden w-72 shrink-0 flex-col overflow-hidden md:flex">
        <div class="p-3">
          <button class="btn btn-primary w-full" (click)="store.newChat()">
            <app-icon name="plus" [size]="16" /> {{ 'chat.newConversation' | t }}
          </button>
        </div>
        <p class="label px-4 pb-2">{{ 'chat.history' | t }}</p>
        <nav class="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          @for (c of store.history(); track c.id) {
            <div
              class="group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition hover:bg-tint/5"
              [class.bg-tint/8]="store.conversationId() === c.id"
              (click)="store.openConversation(c.id)"
            >
              <app-icon name="message" [size]="14" class="text-faint" />
              <span class="min-w-0 flex-1">
                <span class="block truncate">{{ c.title }}</span>
                <span class="block text-[11px] text-faint">{{ c.updatedAt | d: 'd MMM, HH:mm' }}</span>
              </span>
              <button class="text-faint opacity-0 transition group-hover:opacity-100 hover:text-bad" (click)="remove($event, c.id)" [attr.aria-label]="'chat.deleteConversation' | t">
                <app-icon name="trash" [size]="14" />
              </button>
            </div>
          } @empty {
            <p class="px-3 py-2 text-xs text-faint">{{ 'chat.noHistory' | t }}</p>
          }
        </nav>
      </aside>
      <section class="panel flex min-w-0 flex-1 flex-col overflow-hidden">
        <header class="flex items-center gap-2 border-b border-[var(--line)] px-5 py-3.5">
          <app-icon name="sparkles" class="text-violet-soft" />
          <h1 class="h-display flex-1 font-semibold"><span class="ai-text">PropPilot</span> Copilot</h1>
          <button class="btn btn-ghost btn-sm md:hidden" (click)="store.newChat()"><app-icon name="plus" [size]="14" /> {{ 'chat.new' | t }}</button>
        </header>
        <app-copilot-chat [autofocus]="true" />
      </section>
    </div>
  `,
})
export class CopilotPage implements OnInit {
  protected readonly store = inject(CopilotStore);

  ngOnInit() {
    this.store.panelOpen.set(false);
    void this.store.loadHistory();
  }

  remove(event: Event, id: number) {
    event.stopPropagation();
    void this.store.deleteConversation(id);
  }
}
