import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { Auth } from '../../core/auth';
import { CLIENT_STATUS_COLOR, EurPipe, LabelPipe, PROPERTY_STATUS_COLOR, eurCompact } from '../../core/format';
import { DatePipeI18n, TKey, TPipe, currentLang, translate } from '../../core/i18n';
import { Briefing, ClientStatus, DashboardStats } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Markdown } from '../../shared/markdown';
import { AiThinking, Photo } from '../../shared/ui';
import { CopilotStore } from '../copilot/copilot.store';

const BRIEFING_KEY = 'proppilot.briefing';
const t = translate;
const PIPELINE: ClientStatus[] = ['nuevo', 'contactado', 'cualificado', 'visitando', 'negociando', 'cerrado'];

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipeI18n, TPipe, Icon, Markdown, AiThinking, Photo, EurPipe, LabelPipe],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm text-muted">{{ today | d: "EEEE, d 'de' MMMM" }}</p>
          <h1 class="h-display mt-1 text-2xl font-semibold sm:text-3xl">{{ greeting() }}, {{ firstName() }}</h1>
        </div>
        <button class="btn btn-ghost" (click)="copilot.open(t('dash.planPrompt'))">
          <app-icon name="sparkles" class="text-violet-soft" [size]="16" /> {{ 'dash.plan' | t }}
        </button>
      </div>

      <!-- AI briefing -->
      <section class="ai-surface p-5 sm:p-6">
        <div class="flex flex-wrap items-center gap-3">
          <span class="grid size-9 place-items-center rounded-xl bg-[image:var(--grad-ai)] text-white"><app-icon name="sparkles" [size]="18" /></span>
          <div class="flex-1">
            <h2 class="h-display font-semibold">{{ 'dash.briefing' | t }}</h2>
            <p class="text-xs text-faint">{{ 'dash.briefingSub' | t }}</p>
          </div>
          @if (briefing() && !briefingLoading()) {
            <button class="btn btn-ghost btn-sm" (click)="loadBriefing(true)"><app-icon name="refresh" [size]="14" /> {{ 'dash.regenerate' | t }}</button>
          }
        </div>
        <div class="mt-5">
          @if (briefingLoading()) {
            <app-ai-thinking [label]="'dash.analyzing' | t" />
          } @else if (briefing(); as b) {
            <p class="h-display text-lg font-medium">{{ b.headline }}</p>
            <app-markdown class="mt-1 text-muted" [text]="b.summary" />
            <div class="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
              @for (p of b.priorities; track $index) {
                <a
                  [routerLink]="p.propertyId ? ['/properties', p.propertyId] : p.clientId ? ['/clients', p.clientId] : null"
                  class="panel-flat flex gap-3 p-3.5 transition hover:border-[var(--line-strong)]"
                >
                  <span class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-bold text-violet-soft">{{ $index + 1 }}</span>
                  <span>
                    <span class="block text-sm font-semibold">{{ p.title }}</span>
                    <span class="mt-0.5 block text-xs leading-relaxed text-muted">{{ p.detail }}</span>
                  </span>
                </a>
              }
            </div>
          } @else {
            <div class="flex flex-wrap items-center gap-4">
              <p class="flex-1 text-sm text-muted">{{ briefingError() ?? ('dash.briefingEmpty' | t) }}</p>
              <button class="btn btn-primary" (click)="loadBriefing(true)"><app-icon name="sparkles" [size]="16" /> {{ 'dash.generate' | t }}</button>
            </div>
          }
        </div>
      </section>

      @if (stats(); as s) {
        <!-- KPIs -->
        <section class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          @for (k of kpis(); track k.icon) {
            <div class="panel p-4">
              <div class="flex items-center justify-between text-faint">
                <span class="label">{{ k.label | t }}</span>
                <app-icon [name]="k.icon" [size]="16" />
              </div>
              <p class="h-display mt-2 text-2xl font-semibold">{{ k.value }}</p>
              <p class="mt-0.5 text-xs text-faint">{{ k.hint | t }}</p>
            </div>
          }
        </section>

        <div class="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <!-- Pipeline -->
          <section class="panel p-5 xl:col-span-2">
            <div class="flex items-center justify-between">
              <h2 class="h-display font-semibold">{{ 'dash.pipeline' | t }}</h2>
              <a routerLink="/clients" class="text-xs text-violet-soft hover:underline">{{ 'dash.viewBoard' | t }}</a>
            </div>
            <div class="mt-5 space-y-2.5">
              @for (stage of pipeline(); track stage.status) {
                <div class="flex items-center gap-3">
                  <span class="w-24 shrink-0 text-xs text-muted">{{ stage.status | label: 'clientStatus' }}</span>
                  <div class="h-7 flex-1 overflow-hidden rounded-lg bg-white/[0.03]">
                    <div
                      class="flex h-full items-center rounded-lg px-2.5 text-xs font-semibold text-white transition-all duration-700"
                      [style.width.%]="stage.pct"
                      [style.background]="'linear-gradient(90deg,' + stage.color + 'cc,' + stage.color + '66)'"
                    >{{ stage.total }}</div>
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- Portfolio status donut -->
          <section class="panel p-5">
            <h2 class="h-display font-semibold">{{ 'dash.portfolio' | t }}</h2>
            <div class="mt-4 flex items-center gap-5">
              <svg viewBox="0 0 42 42" class="size-32 shrink-0 -rotate-90">
                <circle cx="21" cy="21" r="15.9" fill="none" stroke="rgb(255 255 255 / 0.05)" stroke-width="5" />
                @for (seg of donut(); track seg.status) {
                  <circle cx="21" cy="21" r="15.9" fill="none" [attr.stroke]="seg.color" stroke-width="5"
                    [attr.stroke-dasharray]="seg.pct + ' ' + (100 - seg.pct)" [attr.stroke-dashoffset]="-seg.offset" />
                }
              </svg>
              <ul class="flex-1 space-y-1.5 text-sm">
                @for (seg of donut(); track seg.status) {
                  <li class="flex items-center gap-2">
                    <span class="size-2.5 rounded-full" [style.background]="seg.color"></span>
                    <span class="flex-1 text-muted">{{ seg.status | label: 'status' }}</span>
                    <span class="font-semibold">{{ seg.total }}</span>
                  </li>
                }
              </ul>
            </div>
          </section>

          <!-- Upcoming visits -->
          <section class="panel p-5 xl:col-span-2">
            <div class="flex items-center justify-between">
              <h2 class="h-display font-semibold">{{ 'dash.upcoming' | t }}</h2>
              <a routerLink="/agenda" class="text-xs text-violet-soft hover:underline">{{ 'dash.openAgenda' | t }}</a>
            </div>
            <ul class="mt-4 divide-y divide-[var(--line)]">
              @for (v of s.upcomingVisits; track v.id) {
                <li class="flex items-center gap-3 py-3">
                  <div class="w-14 shrink-0 text-center">
                    <p class="text-[11px] uppercase text-faint">{{ v.scheduledAt | d: 'EEE d' }}</p>
                    <p class="h-display text-base font-semibold">{{ v.scheduledAt | d: 'HH:mm' }}</p>
                  </div>
                  <app-photo class="size-12 shrink-0 rounded-lg" [src]="v.property.images[0]" />
                  <div class="min-w-0 flex-1">
                    <a [routerLink]="['/properties', v.property.id]" class="block truncate text-sm font-medium hover:underline">{{ v.property.title }}</a>
                    <a [routerLink]="['/clients', v.client.id]" class="text-xs text-muted hover:underline">{{ 'common.with' | t: { name: v.client.name } }}</a>
                  </div>
                  <button class="btn btn-ghost btn-sm hidden sm:inline-flex" (click)="prepareVisit(v.property.title, v.client.name)">
                    <app-icon name="sparkles" [size]="14" class="text-violet-soft" /> {{ 'dash.prepare' | t }}
                  </button>
                </li>
              } @empty {
                <li class="py-6 text-center text-sm text-faint">{{ 'dash.noVisits' | t }}</li>
              }
            </ul>
          </section>

          <!-- Hot leads -->
          <section class="panel p-5">
            <div class="flex items-center gap-2">
              <app-icon name="flame" class="text-magenta-soft" />
              <h2 class="h-display flex-1 font-semibold">{{ 'dash.hotLeads' | t }}</h2>
            </div>
            <ul class="mt-4 space-y-2">
              @for (c of s.hotLeads; track c.id) {
                <li>
                  <a [routerLink]="['/clients', c.id]" class="flex items-center gap-3 rounded-xl p-2 transition hover:bg-white/[0.04]">
                    <span class="relative grid size-10 shrink-0 place-items-center">
                      <svg viewBox="0 0 36 36" class="absolute inset-0 -rotate-90">
                        <circle cx="18" cy="18" r="16" fill="none" stroke="rgb(255 255 255 / 0.06)" stroke-width="3" />
                        <circle cx="18" cy="18" r="16" fill="none" stroke="url(#g)" stroke-width="3" stroke-linecap="round" [attr.stroke-dasharray]="(c.leadScore ?? 0) + ' 100'" pathLength="100" />
                        <defs><linearGradient id="g"><stop offset="0" stop-color="#8b5cf6" /><stop offset="1" stop-color="#e64fb0" /></linearGradient></defs>
                      </svg>
                      <span class="text-xs font-bold">{{ c.leadScore }}</span>
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium">{{ c.name }}</span>
                      <span class="block text-xs text-faint">{{ c.status | label: 'clientStatus' }} · {{ c.budgetMax ? ('common.upTo' | t: { value: c.budgetMax | eur }) : (c.type | label: 'clientType') }}</span>
                    </span>
                  </a>
                </li>
              } @empty {
                <li class="text-sm text-faint">{{ 'dash.noLeads' | t }}</li>
              }
            </ul>
          </section>

          <!-- Price per m2 by city -->
          <section class="panel p-5 xl:col-span-2">
            <h2 class="h-display font-semibold">{{ 'dash.priceM2' | t }}</h2>
            <div class="mt-5 flex h-48 items-end gap-1.5 sm:gap-3">
              @for (c of cities(); track c.city) {
                <div class="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <span class="text-[11px] font-semibold sm:text-xs">{{ compact(c.avgPriceM2) }}</span>
                  <div class="w-full max-w-14 rounded-t-lg bg-gradient-to-t from-violet/40 to-magenta/80 transition-all duration-700" [style.height.%]="c.pct"></div>
                  <span class="w-full truncate text-center text-[11px] text-muted" [title]="c.city">{{ c.city }}</span>
                </div>
              }
            </div>
          </section>

          <!-- Needs attention -->
          <section class="panel p-5">
            <h2 class="h-display font-semibold">{{ 'dash.stale' | t }}</h2>
            <p class="mt-1 text-xs text-faint">{{ 'dash.staleSub' | t }}</p>
            <ul class="mt-4 space-y-1">
              @for (p of s.staleListings; track p.id) {
                <li class="flex items-center gap-2">
                  <a [routerLink]="['/properties', p.id]" class="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.04]">{{ p.title }}</a>
                  <button class="text-faint hover:text-violet-soft" [title]="'dash.findBuyers' | t" (click)="findBuyers(p.id, p.title)" [attr.aria-label]="'dash.findBuyers' | t">
                    <app-icon name="target" [size]="16" />
                  </button>
                </li>
              }
            </ul>
          </section>
        </div>
      } @else if (error()) {
        <p class="panel p-6 text-center text-sm text-bad">{{ error() }}</p>
      } @else {
        <div class="grid grid-cols-2 gap-3 lg:grid-cols-6">
          @for (i of [1, 2, 3, 4, 5, 6]; track i) {
            <div class="shimmer h-24"></div>
          }
        </div>
      }
    </div>
  `,
})
export class Dashboard implements OnInit {
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  protected readonly copilot = inject(CopilotStore);

  protected readonly t = translate;
  protected readonly today = new Date();
  protected readonly stats = signal<DashboardStats | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly briefing = signal<Briefing | null>(null);
  protected readonly briefingLoading = signal(false);
  protected readonly briefingError = signal<string | null>(null);

  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  protected readonly greeting = computed(() => {
    const h = this.today.getHours();
    return t(h < 13 ? 'dash.morning' : h < 20 ? 'dash.afternoon' : 'dash.evening');
  });

  protected readonly kpis = computed(() => {
    const k = this.stats()?.kpis;
    if (!k) return [];
    const kpis: { label: TKey; hint: TKey; value: string | number; icon: string }[] = [
      { label: 'dash.kpi.listings', value: k.activeListings, hint: 'dash.kpi.listingsHint', icon: 'building' },
      { label: 'dash.kpi.saleValue', value: eurCompact(k.portfolioSaleValue), hint: 'dash.kpi.saleValueHint', icon: 'euro' },
      { label: 'dash.kpi.rents', value: eurCompact(k.monthlyRentValue), hint: 'dash.kpi.rentsHint', icon: 'home' },
      { label: 'dash.kpi.newLeads', value: k.newClients30d, hint: 'dash.kpi.last30', icon: 'users' },
      { label: 'dash.kpi.visitsDone', value: k.visitsDone30d, hint: 'dash.kpi.last30', icon: 'check' },
      { label: 'dash.kpi.upcoming', value: k.upcomingVisits, hint: 'dash.kpi.upcomingHint', icon: 'calendar' },
    ];
    return kpis;
  });

  protected readonly pipeline = computed(() => {
    const rows = this.stats()?.clientPipeline ?? [];
    const max = Math.max(1, ...rows.map((r) => r.total));
    return PIPELINE.map((status) => {
      const total = rows.find((r) => r.status === status)?.total ?? 0;
      return {
        status,
        total,
        color: CLIENT_STATUS_COLOR[status],
        pct: Math.max(8, (total / max) * 100),
      };
    });
  });

  protected readonly donut = computed(() => {
    const rows = this.stats()?.propertiesByStatus ?? [];
    const sum = rows.reduce((a, r) => a + r.total, 0) || 1;
    let offset = 0;
    return rows.map((r) => {
      const pct = (r.total / sum) * 100;
      const seg = {
        ...r,
        pct,
        offset,
        color: PROPERTY_STATUS_COLOR[r.status],
      };
      offset += pct;
      return seg;
    });
  });

  protected readonly cities = computed(() => {
    const rows = (this.stats()?.propertiesByCity ?? []).filter((c) => c.avgPriceM2).slice(0, 7);
    const max = Math.max(1, ...rows.map((r) => r.avgPriceM2));
    return rows.map((r) => ({ ...r, pct: (r.avgPriceM2 / max) * 85 }));
  });

  protected readonly compact = eurCompact;

  async ngOnInit() {
    this.restoreBriefing();
    try {
      this.stats.set(await this.api.dashboard());
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  private restoreBriefing() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(BRIEFING_KEY) ?? 'null');
      if (cached?.date === this.today.toDateString() && cached.lang === currentLang()) this.briefing.set(cached.briefing);
    } catch {
      // ignore unavailable storage
    }
  }

  async loadBriefing(force = false) {
    if (this.briefing() && !force) return;
    this.briefingLoading.set(true);
    this.briefingError.set(null);
    try {
      const briefing = await this.api.aiBriefing();
      this.briefing.set(briefing);
      try {
        sessionStorage.setItem(BRIEFING_KEY, JSON.stringify({ date: this.today.toDateString(), lang: currentLang(), briefing }));
      } catch {
        // ignore
      }
    } catch (err) {
      this.briefingError.set(errorMessage(err));
    } finally {
      this.briefingLoading.set(false);
    }
  }

  prepareVisit(property: string, client: string) {
    this.copilot.open(t('dash.preparePrompt', { client, property }));
  }

  findBuyers(id: number, title: string) {
    this.copilot.open(t('dash.findBuyersPrompt', { id, title }));
  }
}
