import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CLIENT_STATUSES, EurPipe, LabelPipe, featureLabel, label } from '../../core/format';
import { DatePipeI18n, TDynPipe, TPipe, currentLang, translate } from '../../core/i18n';
import { ClientDetail, ClientInsights, ClientStatus, MatchInfo, Property } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Toasts } from '../../shared/toast';
import { AiThinking, Modal, PropertyCardView } from '../../shared/ui';
import { CopilotStore } from '../copilot/copilot.store';
import { ClientForm } from './client-form';

@Component({
  selector: 'app-client-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, DatePipeI18n, TPipe, TDynPipe, Icon, AiThinking, Modal, PropertyCardView, ClientForm, EurPipe, LabelPipe],
  template: `
    @if (client(); as c) {
      <div class="space-y-6 animate-fade-up">
        <div class="flex flex-wrap items-start gap-4">
          <a routerLink="/clients" class="btn btn-ghost btn-icon" [attr.aria-label]="'common.back' | t"><app-icon name="chevron-left" /></a>
          <span class="grid size-14 place-items-center rounded-2xl bg-[image:var(--grad-ai)] text-lg font-bold text-white">{{ initials() }}</span>
          <div class="min-w-0 flex-1">
            <h1 class="h-display text-2xl font-semibold sm:text-3xl">{{ c.name }}</h1>
            <div class="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>{{ c.type | label: 'clientType' }}</span>
              @if (c.source) { <span>· {{ 'client.via' | t: { source: c.source } }}</span> }
              <span>· {{ 'client.since' | t: { date: (c.createdAt | d: 'MMM y') } }}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <select class="input !h-10 !w-auto" [ngModel]="c.status" (ngModelChange)="changeStatus($event)" [attr.aria-label]="'props.status' | t">
              @for (s of statuses; track s) { <option [value]="s">{{ s | label: 'clientStatus' }}</option> }
            </select>
            @if (c.phone) {
              <a class="btn btn-ghost btn-icon" [href]="'tel:' + c.phone" [attr.aria-label]="'client.call' | t"><app-icon name="phone" [size]="16" /></a>
            }
            @if (c.email) {
              <a class="btn btn-ghost btn-icon" [href]="'mailto:' + c.email" aria-label="Email"><app-icon name="mail" [size]="16" /></a>
            }
            <button class="btn btn-ghost" (click)="editing.set(true)"><app-icon name="edit" [size]="15" /> {{ 'common.edit' | t }}</button>
            <button class="btn btn-ghost btn-icon text-bad" (click)="confirmDelete.set(true)" [attr.aria-label]="'common.delete' | t"><app-icon name="trash" [size]="16" /></button>
          </div>
        </div>

        <div class="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div class="space-y-6">
            <section class="panel grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              <div>
                <p class="label">{{ 'client.contact' | t }}</p>
                <p class="mt-2 text-sm">{{ c.email ?? '—' }}</p>
                <p class="text-sm text-muted">{{ c.phone ?? '—' }}</p>
              </div>
              <div>
                <p class="label">{{ 'board.budget' | t }}</p>
                <p class="h-display mt-2 text-lg font-semibold">
                  @if (c.budgetMin || c.budgetMax) { {{ c.budgetMin ? (c.budgetMin | eur) + ' – ' : ('client.upToPrefix' | t) }}{{ c.budgetMax | eur }} } @else { — }
                </p>
              </div>
              <div class="sm:col-span-2">
                <p class="label">{{ 'cform.looking' | t }}</p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  @for (chip of prefChips(); track chip) {
                    <span class="chip">{{ chip }}</span>
                  } @empty {
                    <span class="text-sm text-faint">{{ 'client.noPrefs' | t }}</span>
                  }
                </div>
              </div>
              @if (c.notes) {
                <div class="sm:col-span-2">
                  <p class="label">{{ 'cform.notes' | t }}</p>
                  <p class="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted">{{ c.notes }}</p>
                </div>
              }
            </section>

            <section>
              <div class="mb-3 flex items-center justify-between">
                <h2 class="h-display font-semibold">{{ 'client.recommended' | t }}</h2>
                <span class="text-xs text-faint">{{ 'client.byFit' | t }}</span>
              </div>
              <div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                @for (m of matches(); track m.property.id) {
                  <div class="flex flex-col gap-2">
                    <app-property-card [property]="withScore(m)" [compact]="true" />
                    @if (aiReason(m.property.id); as reason) {
                      <p class="ai-surface px-3 py-2 text-xs leading-snug text-muted"><span class="ai-text font-semibold">{{ 'client.ai' | t }}</span> {{ reason }}</p>
                    }
                  </div>
                } @empty {
                  <p class="panel col-span-full p-6 text-center text-sm text-faint">{{ 'client.noMatches' | t }}</p>
                }
              </div>
            </section>

            <section class="panel p-5 sm:p-6">
              <div class="flex items-center justify-between">
                <h2 class="h-display font-semibold">{{ 'client.visitHistory' | t }}</h2>
                <a routerLink="/agenda" [queryParams]="{ clientId: c.id }" class="btn btn-ghost btn-sm"><app-icon name="plus" [size]="14" /> {{ 'detail.schedule' | t }}</a>
              </div>
              <ol class="mt-4 space-y-4 border-l border-[var(--line-strong)] pl-5">
                @for (v of c.visits; track v.id) {
                  <li class="relative">
                    <span class="absolute top-1.5 -left-[25px] size-2.5 rounded-full" [class]="v.status === 'realizada' ? 'bg-ok' : v.status === 'cancelada' ? 'bg-bad' : 'bg-violet'"></span>
                    <p class="text-xs text-faint">{{ v.scheduledAt | d: "EEEE d MMM y, HH:mm" }} · {{ v.status | label: 'visitStatus' }}</p>
                    <a [routerLink]="['/properties', v.property.id]" class="text-sm font-medium hover:underline">{{ v.property.title }}</a>
                    @if (v.feedback) { <p class="mt-1 text-sm text-muted">«{{ v.feedback }}»</p> }
                    @if (v.notes) { <p class="mt-1 text-xs text-faint">{{ v.notes }}</p> }
                  </li>
                } @empty {
                  <li class="text-sm text-faint">{{ 'detail.noVisits' | t }}</li>
                }
              </ol>
            </section>
          </div>

          <!-- AI insights -->
          <aside class="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <section class="ai-surface p-5">
              <div class="flex items-center gap-2">
                <app-icon name="sparkles" class="text-violet-soft" />
                <h2 class="h-display flex-1 font-semibold">{{ 'client.analysis' | t }}</h2>
                @if (insights() && !insightsLoading()) {
                  <button class="text-xs text-faint hover:text-fg" (click)="analyze()">{{ 'client.refresh' | t }}</button>
                }
              </div>

              @if (insightsLoading()) {
                <div class="mt-4"><app-ai-thinking [label]="'client.analyzing' | t" /></div>
              } @else if (insights(); as ins) {
                <div class="mt-5 flex items-center gap-4 animate-fade-up">
                  <div class="relative grid size-20 place-items-center">
                    <svg viewBox="0 0 36 36" class="absolute inset-0 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" class="stroke-tint/7" stroke-width="3" />
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#lead)" stroke-width="3" stroke-linecap="round" pathLength="100" [attr.stroke-dasharray]="ins.leadScore + ' 100'" />
                      <defs><linearGradient id="lead"><stop offset="0" stop-color="#8b5cf6" /><stop offset="1" stop-color="#e64fb0" /></linearGradient></defs>
                    </svg>
                    <span class="h-display text-xl font-bold">{{ ins.leadScore }}</span>
                  </div>
                  <div>
                    <span class="chip" [class]="tempClass(ins.temperature)"><app-icon name="flame" [size]="12" /> {{ 'temperature.' + ins.temperature | td }}</span>
                    <p class="mt-2 text-sm leading-snug text-muted">{{ ins.summary }}</p>
                  </div>
                </div>
                <div class="mt-5 rounded-xl bg-tint/[0.04] p-3.5">
                  <p class="label">{{ 'client.nextAction' | t }}</p>
                  <p class="mt-1 text-sm font-medium">{{ ins.nextBestAction }}</p>
                </div>
                @if (ins.risks.length) {
                  <div class="mt-4">
                    <p class="label">{{ 'client.risks' | t }}</p>
                    <ul class="mt-1.5 space-y-1 text-sm text-muted">
                      @for (r of ins.risks; track r) {
                        <li class="flex gap-2"><app-icon name="alert" [size]="14" class="mt-0.5 text-warn" /> {{ r }}</li>
                      }
                    </ul>
                  </div>
                }
                <div class="mt-4">
                  <div class="flex items-center justify-between">
                    <p class="label">{{ 'client.followUp' | t }}</p>
                    <button class="text-faint hover:text-fg" (click)="copy(ins.followUpMessage)" [attr.aria-label]="'common.copy' | t"><app-icon name="copy" [size]="14" /></button>
                  </div>
                  <p class="mt-1.5 rounded-xl border border-[var(--line)] p-3 text-sm whitespace-pre-line">{{ ins.followUpMessage }}</p>
                  @if (c.phone) {
                    <a class="btn btn-primary mt-3 w-full" target="_blank" rel="noopener" [href]="whatsapp(c.phone, ins.followUpMessage)">
                      <app-icon name="send" [size]="15" /> {{ 'client.sendWhatsapp' | t }}
                    </a>
                  }
                </div>
              } @else {
                <p class="mt-3 text-sm text-muted">
                  {{ c.aiSummary ?? ('client.analysisIntro' | t) }}
                </p>
                <button class="btn btn-primary mt-4 w-full" (click)="analyze()"><app-icon name="sparkles" [size]="16" /> {{ 'client.analyze' | t }}</button>
              }
              @if (insightsError()) {
                <p class="mt-3 text-sm text-bad">{{ insightsError() }}</p>
              }
            </section>

            <button class="btn btn-ghost w-full" (click)="copilot.open(t('client.copilotPrompt', { id: c.id, name: c.name }))">
              <app-icon name="bot" [size]="16" class="text-violet-soft" /> {{ 'client.talkCopilot' | t: { name: c.name.split(' ')[0] } }}
            </button>
          </aside>
        </div>
      </div>

      <app-modal [(open)]="editing" [title]="'client.editTitle' | t" width="680px">
        <app-client-form [client]="c" (saved)="onSaved()" />
      </app-modal>
      <app-modal [(open)]="confirmDelete" [title]="'client.deleteTitle' | t" width="420px">
        <p class="text-sm text-muted">{{ 'client.deleteConfirm' | t: { name: c.name } }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button class="btn btn-ghost" (click)="confirmDelete.set(false)">{{ 'common.cancel' | t }}</button>
          <button class="btn btn-danger" (click)="remove()">{{ 'common.delete' | t }}</button>
        </div>
      </app-modal>
    } @else if (error()) {
      <p class="panel p-8 text-center text-bad">{{ error() }}</p>
    } @else {
      <div class="space-y-4"><div class="shimmer h-14 w-1/2"></div><div class="shimmer h-64"></div></div>
    }
  `,
})
export class ClientDetailPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  protected readonly copilot = inject(CopilotStore);

  readonly id = input.required<string>();

  protected readonly client = signal<ClientDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly matches = signal<(MatchInfo & { property: Property })[]>([]);
  protected readonly insights = signal<ClientInsights | null>(null);
  protected readonly insightsLoading = signal(false);
  protected readonly insightsError = signal<string | null>(null);
  protected readonly editing = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly t = translate;
  protected readonly statuses = CLIENT_STATUSES;

  protected readonly initials = computed(() =>
    (this.client()?.name ?? '')
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase(),
  );

  protected readonly prefChips = computed(() => {
    const p = this.client()?.preferences;
    if (!p) return [];
    const chips: string[] = [];
    if (p.operation) chips.push(translate(p.operation === 'venta' ? 'cform.buy' : 'operation.alquiler'));
    p.types?.forEach((type) => chips.push(label('type', type)));
    p.cities?.forEach((c) => chips.push(c));
    p.districts?.forEach((d) => chips.push(d));
    if (p.minBedrooms) chips.push(translate('props.minBeds', { n: p.minBedrooms }));
    if (p.minArea) chips.push(`${p.minArea}+ m²`);
    p.features?.forEach((f) => chips.push(featureLabel(f)));
    return chips;
  });

  constructor() {
    effect(() => {
      const id = Number(this.id());
      this.copilot.dataVersion();
      currentLang(); // match reasons come localised from the API
      untracked(() => this.load(id));
    });
  }

  private async load(id: number) {
    try {
      const [client, matches] = await Promise.all([this.api.client(id), this.api.clientMatches(id)]);
      this.client.set(client);
      this.matches.set(matches);
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  withScore = (m: MatchInfo & { property: Property }) => ({ ...m.property, score: m.score });
  aiReason = (propertyId: number) => this.insights()?.recommendations.find((r) => r.propertyId === propertyId)?.reason;

  tempClass(t: ClientInsights['temperature']) {
    return t === 'caliente' ? '!text-magenta-soft !border-magenta/40' : t === 'templado' ? '!text-warn !border-warn/40' : '!text-info !border-info/40';
  }

  async analyze() {
    this.insightsLoading.set(true);
    this.insightsError.set(null);
    try {
      const ins = await this.api.aiInsights(this.client()!.id);
      this.insights.set(ins);
      this.client.update((c) => (c ? { ...c, leadScore: ins.leadScore, aiSummary: ins.summary } : c));
    } catch (err) {
      this.insightsError.set(errorMessage(err));
    } finally {
      this.insightsLoading.set(false);
    }
  }

  async changeStatus(status: ClientStatus) {
    const c = this.client()!;
    await this.api.updateClient(c.id, { status });
    this.client.set({ ...c, status });
    this.toasts.show(translate('detail.statusUpdated', { status: label('clientStatus', status) }));
  }

  onSaved() {
    this.editing.set(false);
    void this.load(this.client()!.id);
  }

  async remove() {
    await this.api.deleteClient(this.client()!.id);
    this.toasts.show(translate('client.deleted'));
    void this.router.navigateByUrl('/clients');
  }

  whatsapp(phone: string, text: string) {
    return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  }

  async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.toasts.show(translate('common.copied'));
    } catch {
      this.toasts.error(translate('common.copyFailed'));
    }
  }
}
