import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { LabelPipe } from '../../core/format';
import { DatePipeI18n, TPipe, translate } from '../../core/i18n';
import { Client, Property, VisitStatus, VisitWithRefs } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Toasts } from '../../shared/toast';
import { Modal } from '../../shared/ui';
import { CopilotStore } from '../copilot/copilot.store';

const HOUR_START = 8;
const HOUR_END = 21;
const ROW = 56; // px per hour

const startOfWeek = (d: Date) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

@Component({
  selector: 'app-agenda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DatePipeI18n, TPipe, Icon, Modal, LabelPipe],
  template: `
    <div class="space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="h-display text-2xl font-semibold sm:text-3xl">{{ 'title.agenda' | t }}</h1>
          <p class="mt-1 text-sm text-muted">{{ weekStart() | d: "d MMM" }} – {{ weekEnd() | d: "d MMM y" }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-ghost btn-icon" (click)="shift(-7)" [attr.aria-label]="'agenda.prevWeek' | t"><app-icon name="chevron-left" /></button>
          <button class="btn btn-ghost" (click)="weekStart.set(startOf(now))">{{ 'agenda.today' | t }}</button>
          <button class="btn btn-ghost btn-icon" (click)="shift(7)" [attr.aria-label]="'agenda.nextWeek' | t"><app-icon name="chevron-right" /></button>
          <button class="btn btn-ghost" (click)="copilot.open(t('agenda.optimizePrompt'))">
            <app-icon name="sparkles" [size]="16" class="text-violet-soft" /> {{ 'agenda.optimize' | t }}
          </button>
          <button class="btn btn-primary" (click)="openNew()"><app-icon name="plus" [size]="16" /> {{ 'agenda.newVisit' | t }}</button>
        </div>
      </div>

      <!-- Week grid (desktop) -->
      <div class="panel hidden overflow-hidden md:block">
        <div class="grid grid-cols-[56px_repeat(7,1fr)] border-b border-[var(--line)]">
          <div></div>
          @for (d of days(); track d.toISOString()) {
            <div class="border-l border-[var(--line)] px-2 py-2.5 text-center" [class.bg-violet/10]="isToday(d)">
              <p class="text-[11px] uppercase text-faint">{{ d | d: 'EEE' }}</p>
              <p class="h-display text-lg font-semibold" [class.ai-text]="isToday(d)">{{ d | d: 'd' }}</p>
            </div>
          }
        </div>
        <div class="relative grid max-h-[68vh] grid-cols-[56px_repeat(7,1fr)] overflow-y-auto">
          <div>
            @for (h of hours; track h) {
              <div class="pr-2 text-right text-[11px] text-faint" [style.height.px]="row">{{ h }}:00</div>
            }
          </div>
          @for (d of days(); track d.toISOString()) {
            <div class="relative border-l border-[var(--line)]" [style.height.px]="row * hours.length" (dblclick)="openNew(d, $event)">
              @for (h of hours; track h) {
                <div class="border-t border-[var(--line)]/50" [style.height.px]="row"></div>
              }
              @for (v of visitsOn(d); track v.id) {
                <button
                  class="absolute inset-x-1 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left text-[11px] leading-tight transition hover:brightness-125"
                  [class]="visitClass(v.status)"
                  [style.top.px]="top(v)"
                  [style.height.px]="height(v)"
                  (click)="select(v)"
                >
                  <span class="block font-semibold">{{ v.scheduledAt | d: 'HH:mm' }} · {{ v.client.name }}</span>
                  <span class="block truncate opacity-80">{{ v.property.title }}</span>
                </button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Day list (mobile) -->
      <div class="space-y-3 md:hidden">
        @for (d of days(); track d.toISOString()) {
          <section class="panel p-4">
            <p class="text-sm font-semibold" [class.ai-text]="isToday(d)">{{ d | d: "EEEE d 'de' MMMM" }}</p>
            @for (v of visitsOn(d); track v.id) {
              <button class="mt-2 flex w-full items-center gap-3 rounded-xl border-l-[3px] px-3 py-2 text-left text-sm" [class]="visitClass(v.status)" (click)="select(v)">
                <span class="font-semibold">{{ v.scheduledAt | d: 'HH:mm' }}</span>
                <span class="min-w-0 flex-1 truncate">{{ v.client.name }} · {{ v.property.title }}</span>
              </button>
            } @empty {
              <p class="mt-1 text-xs text-faint">{{ 'agenda.noVisits' | t }}</p>
            }
          </section>
        }
      </div>
    </div>

    <!-- Visit detail -->
    <app-modal [open]="!!selected()" (closed)="selected.set(null)" [title]="'agenda.visit' | t" width="480px">
      @if (selected(); as v) {
        <p class="text-sm text-muted">{{ v.scheduledAt | d: "EEEE d 'de' MMMM, HH:mm" }} · {{ v.durationMin }} min</p>
        <a [routerLink]="['/properties', v.property.id]" class="mt-3 block font-semibold hover:underline">{{ v.property.title }}</a>
        <p class="text-sm text-muted">{{ v.property.address }}, {{ v.property.city }}</p>
        <a [routerLink]="['/clients', v.client.id]" class="mt-3 flex items-center gap-2 text-sm hover:underline"><app-icon name="users" [size]="15" /> {{ v.client.name }} {{ v.client.phone ? '· ' + v.client.phone : '' }}</a>
        @if (v.notes) { <p class="mt-3 rounded-lg bg-tint/[0.04] p-3 text-sm">{{ v.notes }}</p> }
        <label class="mt-4 block">
          <span class="label">{{ 'agenda.feedback' | t }}</span>
          <textarea class="input mt-1.5" rows="3" [(ngModel)]="feedback" [placeholder]="'agenda.feedbackPlaceholder' | t"></textarea>
        </label>
        <div class="mt-4 flex flex-wrap justify-between gap-2">
          <button class="btn btn-danger btn-sm" (click)="remove(v)"><app-icon name="trash" [size]="14" /> {{ 'common.delete' | t }}</button>
          <div class="flex flex-wrap gap-2">
            @if (v.status !== 'cancelada') {
              <button class="btn btn-ghost btn-sm" (click)="setStatus(v, 'cancelada')">{{ 'agenda.cancelVisit' | t }}</button>
            }
            <button class="btn btn-primary btn-sm" (click)="setStatus(v, 'realizada')"><app-icon name="check" [size]="14" /> {{ 'agenda.markDone' | t }}</button>
          </div>
        </div>
        <button class="btn btn-ghost mt-3 w-full" (click)="prepare(v)"><app-icon name="sparkles" [size]="15" class="text-violet-soft" /> {{ 'agenda.prepare' | t }}</button>
      }
    </app-modal>

    <!-- New visit -->
    <app-modal [(open)]="creating" [title]="'agenda.newVisit' | t" width="520px">
      <form class="grid gap-4" (submit)="create($event)">
        <label><span class="label">{{ 'title.property' | t }}</span>
          <select class="input mt-1.5" name="propertyId" [(ngModel)]="draft.propertyId" required>
            <option [ngValue]="null" disabled>{{ 'agenda.pickProperty' | t }}</option>
            @for (p of properties(); track p.id) { <option [ngValue]="p.id">{{ p.reference }} · {{ p.title }}</option> }
          </select>
        </label>
        <label><span class="label">{{ 'title.client' | t }}</span>
          <select class="input mt-1.5" name="clientId" [(ngModel)]="draft.clientId" required>
            <option [ngValue]="null" disabled>{{ 'agenda.pickClient' | t }}</option>
            @for (c of clients(); track c.id) { <option [ngValue]="c.id">{{ c.name }} ({{ c.status | label: 'clientStatus' }})</option> }
          </select>
        </label>
        <div class="grid grid-cols-[1fr_120px] gap-3">
          <label><span class="label">{{ 'agenda.when' | t }}</span><input class="input mt-1.5" type="datetime-local" name="when" [(ngModel)]="draft.when" required /></label>
          <label><span class="label">{{ 'agenda.duration' | t }}</span>
            <select class="input mt-1.5" name="dur" [(ngModel)]="draft.durationMin">
              <option [ngValue]="30">30 min</option><option [ngValue]="45">45 min</option><option [ngValue]="60">1 h</option><option [ngValue]="90">1 h 30</option>
            </select>
          </label>
        </div>
        <label><span class="label">{{ 'cform.notes' | t }}</span><textarea class="input mt-1.5" rows="2" name="notes" [(ngModel)]="draft.notes"></textarea></label>
        <div class="flex justify-end"><button class="btn btn-primary" type="submit" [disabled]="!draft.propertyId || !draft.clientId || !draft.when">{{ 'agenda.schedule' | t }}</button></div>
      </form>
    </app-modal>
  `,
})
export class Agenda implements OnInit {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);
  protected readonly copilot = inject(CopilotStore);

  readonly propertyId = input<string>();
  readonly clientId = input<string>();

  protected readonly t = translate;
  protected readonly now = new Date();
  protected readonly row = ROW;
  protected readonly hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  protected readonly startOf = startOfWeek;
  protected readonly weekStart = signal(startOfWeek(this.now));
  protected readonly weekEnd = computed(() => addDays(this.weekStart(), 6));
  protected readonly days = computed(() => Array.from({ length: 7 }, (_, i) => addDays(this.weekStart(), i)));

  protected readonly visits = signal<VisitWithRefs[]>([]);
  protected readonly selected = signal<VisitWithRefs | null>(null);
  protected readonly creating = signal(false);
  protected readonly properties = signal<Property[]>([]);
  protected readonly clients = signal<Client[]>([]);
  protected feedback = '';
  protected draft = { propertyId: null as number | null, clientId: null as number | null, when: '', durationMin: 45, notes: '' };

  constructor() {
    effect(() => {
      const from = this.weekStart();
      this.copilot.dataVersion();
      untracked(() => this.load(from));
    });
  }

  ngOnInit() {
    if (this.propertyId() || this.clientId()) this.openNew();
  }

  private async load(from: Date) {
    try {
      this.visits.set(await this.api.visits({ from: from.toISOString(), to: addDays(from, 7).toISOString() }));
    } catch (err) {
      this.toasts.error(errorMessage(err));
    }
  }

  shift(days: number) {
    this.weekStart.update((d) => addDays(d, days));
  }

  isToday = (d: Date) => sameDay(d, this.now);
  visitsOn = (d: Date) => this.visits().filter((v) => sameDay(new Date(v.scheduledAt), d));

  top(v: VisitWithRefs) {
    const d = new Date(v.scheduledAt);
    return Math.max(0, (d.getHours() + d.getMinutes() / 60 - HOUR_START) * ROW);
  }
  height = (v: VisitWithRefs) => Math.max(26, (v.durationMin / 60) * ROW - 2);

  visitClass(status: VisitStatus) {
    return {
      programada: 'bg-violet/20 border-violet text-fg',
      realizada: 'bg-ok/10 border-ok text-muted',
      cancelada: 'bg-tint/5 border-faint text-faint line-through',
    }[status];
  }

  select(v: VisitWithRefs) {
    this.feedback = v.feedback ?? '';
    this.selected.set(v);
  }

  async openNew(day?: Date, event?: MouseEvent) {
    const when = day ? new Date(day) : new Date(this.now.getTime() + 86400000);
    if (event) {
      const y = event.offsetY;
      when.setHours(HOUR_START + Math.floor(y / ROW), (y % ROW) >= ROW / 2 ? 30 : 0, 0, 0);
    } else if (!day) when.setHours(11, 0, 0, 0);
    this.draft = {
      propertyId: this.propertyId() ? Number(this.propertyId()) : null,
      clientId: this.clientId() ? Number(this.clientId()) : null,
      when: toLocalInput(when),
      durationMin: 45,
      notes: '',
    };
    this.creating.set(true);
    if (!this.properties().length) {
      const [props, clients] = await Promise.all([
        this.api.properties({ statuses: ['disponible', 'reservado'], limit: 200 }),
        this.api.clients(),
      ]);
      this.properties.set(props.items);
      this.clients.set(clients.filter((c) => !['cerrado', 'perdido'].includes(c.status)));
    }
  }

  async create(event: Event) {
    event.preventDefault();
    try {
      await this.api.createVisit({
        propertyId: this.draft.propertyId!,
        clientId: this.draft.clientId!,
        scheduledAt: new Date(this.draft.when).toISOString(),
        durationMin: this.draft.durationMin,
        notes: this.draft.notes || null,
      });
      this.creating.set(false);
      this.weekStart.set(startOfWeek(new Date(this.draft.when)));
      void this.load(this.weekStart());
      this.toasts.show(translate('agenda.scheduled'));
    } catch (err) {
      this.toasts.error(errorMessage(err));
    }
  }

  async setStatus(v: VisitWithRefs, status: VisitStatus) {
    await this.api.updateVisit(v.id, { status, feedback: this.feedback || null });
    this.selected.set(null);
    void this.load(this.weekStart());
    this.toasts.show(translate(status === 'realizada' ? 'agenda.markedDone' : 'agenda.cancelled'));
  }

  async remove(v: VisitWithRefs) {
    await this.api.deleteVisit(v.id);
    this.selected.set(null);
    void this.load(this.weekStart());
  }

  prepare(v: VisitWithRefs) {
    this.selected.set(null);
    this.copilot.open(
      translate('agenda.preparePrompt', {
        id: v.id,
        client: v.client.name,
        clientId: v.client.id,
        property: v.property.title,
        propertyId: v.property.id,
      }),
    );
  }
}
