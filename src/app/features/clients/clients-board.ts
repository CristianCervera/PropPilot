import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CLIENT_STATUS_COLOR, CLIENT_STATUSES, EurPipe, LabelPipe, label } from '../../core/format';
import { TPipe, translate } from '../../core/i18n';
import { Client, ClientStatus } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Toasts } from '../../shared/toast';
import { Modal, StatusBadge } from '../../shared/ui';
import { CopilotStore } from '../copilot/copilot.store';
import { ClientForm } from './client-form';


@Component({
  selector: 'app-clients-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CdkDropListGroup, CdkDropList, CdkDrag, Icon, Modal, ClientForm, StatusBadge, EurPipe, LabelPipe, TPipe],
  template: `
    <div class="space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="h-display text-2xl font-semibold sm:text-3xl">{{ 'title.clients' | t }}</h1>
          <p class="mt-1 text-sm text-muted">{{ 'board.subtitle' | t }}</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost" (click)="copilot.open(t('board.analyzePrompt'))">
            <app-icon name="sparkles" [size]="16" class="text-violet-soft" /> {{ 'board.analyze' | t }}
          </button>
          <button class="btn btn-primary" (click)="creating.set(true)"><app-icon name="plus" [size]="16" /> {{ 'board.newClient' | t }}</button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-60 flex-1 sm:max-w-sm">
          <app-icon name="search" [size]="15" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input class="input !pl-9" [placeholder]="'board.searchPlaceholder' | t" [ngModel]="q()" (ngModelChange)="q.set($event)" [attr.aria-label]="'board.searchAria' | t" />
        </div>
        <div class="flex rounded-xl border border-[var(--line)] p-0.5">
          <button class="btn btn-sm" [class]="mode() === 'board' ? 'bg-white/10' : 'text-faint'" (click)="mode.set('board')"><app-icon name="grid" [size]="14" /> {{ 'board.board' | t }}</button>
          <button class="btn btn-sm" [class]="mode() === 'table' ? 'bg-white/10' : 'text-faint'" (click)="mode.set('table')"><app-icon name="list" [size]="14" /> {{ 'props.viewList' | t }}</button>
        </div>
      </div>

      @if (mode() === 'board') {
        <div class="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6" cdkDropListGroup>
          @for (col of columns(); track col.status) {
            <section class="flex w-72 shrink-0 flex-col rounded-2xl border border-[var(--line)] bg-ink-900/50">
              <header class="flex items-center gap-2 px-3.5 pt-3.5 pb-2">
                <span class="size-2.5 rounded-full" [style.background]="col.color"></span>
                <h2 class="flex-1 text-sm font-semibold">{{ col.status | label: 'clientStatus' }}</h2>
                <span class="text-xs text-faint">{{ col.items.length }}</span>
              </header>
              <div
                class="flex min-h-32 flex-1 flex-col gap-2 p-2"
                cdkDropList
                [cdkDropListData]="col.status"
                (cdkDropListDropped)="drop($event)"
              >
                @for (c of col.items; track c.id) {
                  <article
                    cdkDrag
                    [cdkDragData]="c"
                    class="panel-flat cursor-grab p-3 transition hover:border-[var(--line-strong)] active:cursor-grabbing"
                    (click)="open(c)"
                  >
                    <div class="flex items-start gap-2">
                      <p class="flex-1 text-sm font-semibold leading-snug">{{ c.name }}</p>
                      @if (c.leadScore != null) {
                        <span class="rounded-md px-1.5 py-0.5 text-[11px] font-bold" [class]="scoreClass(c.leadScore)">{{ c.leadScore }}</span>
                      }
                    </div>
                    <p class="mt-1 text-xs text-muted">{{ c.type | label: 'clientType' }}{{ c.budgetMax ? ' · ' + ('common.upTo' | t: { value: c.budgetMax | eur }) : '' }}</p>
                    @if (c.preferences.cities?.length) {
                      <p class="mt-1 flex items-center gap-1 text-[11px] text-faint"><app-icon name="pin" [size]="11" /> {{ c.preferences.cities?.join(', ') }}</p>
                    }
                    @if (c.aiSummary) {
                      <p class="mt-2 line-clamp-2 border-l-2 border-violet/50 pl-2 text-[11px] leading-snug text-muted">{{ c.aiSummary }}</p>
                    }
                  </article>
                }
              </div>
            </section>
          }
        </div>
      } @else {
        <div class="panel overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left">
              <tr class="border-b border-[var(--line)]">
                <th class="label px-4 py-3">{{ 'board.name' | t }}</th><th class="label px-4 py-3">{{ 'props.type' | t }}</th><th class="label px-4 py-3">{{ 'props.status' | t }}</th>
                <th class="label px-4 py-3">{{ 'board.budget' | t }}</th><th class="label px-4 py-3">{{ 'board.score' | t }}</th><th class="label px-4 py-3">{{ 'board.source' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of filtered(); track c.id) {
                <tr class="cursor-pointer border-b border-[var(--line)] last:border-0 hover:bg-white/[0.03]" (click)="open(c)">
                  <td class="px-4 py-3"><p class="font-medium">{{ c.name }}</p><p class="text-xs text-faint">{{ c.email }}</p></td>
                  <td class="px-4 py-3 text-muted">{{ c.type | label: 'clientType' }}</td>
                  <td class="px-4 py-3"><app-status-badge [value]="c.status" kind="client" /></td>
                  <td class="px-4 py-3 text-muted">{{ c.budgetMax ? (c.budgetMax | eur) : '—' }}</td>
                  <td class="px-4 py-3">{{ c.leadScore ?? '—' }}</td>
                  <td class="px-4 py-3 text-muted">{{ c.source ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <app-modal [(open)]="creating" [title]="'board.newClient' | t" width="680px">
      <app-client-form (saved)="onCreated($event)" />
    </app-modal>
  `,
})
export class ClientsBoard {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  protected readonly copilot = inject(CopilotStore);

  protected readonly t = translate;
  protected readonly clients = signal<Client[]>([]);
  protected readonly q = signal('');
  protected readonly mode = signal<'board' | 'table'>('board');
  protected readonly creating = signal(false);

  protected readonly filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    if (!q) return this.clients();
    return this.clients().filter((c) =>
      [c.name, c.email, c.phone, c.notes, c.source].some((v) => v?.toLowerCase().includes(q)),
    );
  });

  protected readonly columns = computed(() =>
    CLIENT_STATUSES.map((status) => ({
      status,
      color: CLIENT_STATUS_COLOR[status],
      items: this.filtered().filter((c) => c.status === status),
    })),
  );

  constructor() {
    effect(() => {
      this.copilot.dataVersion();
      untracked(() => this.load());
    });
  }

  private async load() {
    try {
      this.clients.set(await this.api.clients());
    } catch (err) {
      this.toasts.error(errorMessage(err));
    }
  }

  scoreClass(score: number) {
    return score >= 75 ? 'bg-magenta/20 text-magenta-soft' : score >= 50 ? 'bg-violet/20 text-violet-soft' : 'bg-white/5 text-faint';
  }

  async drop(event: CdkDragDrop<ClientStatus>) {
    const client = event.item.data as Client;
    const status = event.container.data;
    if (client.status === status) return;
    const previous = client.status;
    this.clients.update((list) => list.map((c) => (c.id === client.id ? { ...c, status } : c)));
    try {
      await this.api.updateClient(client.id, { status });
      this.toasts.show(`${client.name} → ${label('clientStatus', status)}`);
    } catch (err) {
      this.clients.update((list) => list.map((c) => (c.id === client.id ? { ...c, status: previous } : c)));
      this.toasts.error(errorMessage(err));
    }
  }

  open(c: Client) {
    void this.router.navigate(['/clients', c.id]);
  }

  onCreated(c: Client) {
    this.creating.set(false);
    void this.router.navigate(['/clients', c.id]);
  }
}
