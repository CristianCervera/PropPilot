import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { EurPipe, LabelPipe, PROPERTY_TYPES, eur, featureLabel, label } from '../../core/format';
import { TKey, TPipe, translate } from '../../core/i18n';
import { AiSearchResult, Operation, Property, PropertyFilters, PropertyStatus, PropertyType } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Photo, PropertyCardView, StatusBadge } from '../../shared/ui';
import { CopilotStore } from '../copilot/copilot.store';
import { PropertiesMap } from './properties-map';

type View = 'grid' | 'list' | 'map';
const VIEW_KEY = 'proppilot.properties.view';

const EXAMPLES: TKey[] = ['props.example1', 'props.example2', 'props.example3', 'props.example4'];

@Component({
  selector: 'app-properties-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, Icon, PropertyCardView, PropertiesMap, Photo, StatusBadge, EurPipe, LabelPipe, TPipe],
  template: `
    <div class="space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="h-display text-2xl font-semibold sm:text-3xl">{{ 'title.properties' | t }}</h1>
          <p class="mt-1 text-sm text-muted">{{ 'props.results' | t: { n: total() } }}</p>
        </div>
        <a routerLink="/properties/new" class="btn btn-primary sm:hidden"><app-icon name="plus" [size]="16" /> {{ 'props.new' | t }}</a>
      </div>

      <!-- AI search -->
      <form class="ai-surface p-2" (submit)="aiSearch($event)">
        <div class="flex items-center gap-2">
          <app-icon name="sparkles" class="ml-2.5 text-violet-soft" />
          <input
            class="h-11 min-w-0 flex-1 bg-transparent px-1 text-[15px] outline-none placeholder:text-faint"
            [placeholder]="'props.aiPlaceholder' | t"
            [(ngModel)]="aiQuery"
            name="aiQuery"
            [attr.aria-label]="'props.aiAria' | t"
          />
          <button class="btn btn-primary" type="submit" [disabled]="aiLoading() || aiQuery().trim().length < 3">
            @if (aiLoading()) {
              <span class="size-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
            } @else {
              <app-icon name="search" [size]="16" />
            }
            <span class="hidden sm:inline">{{ 'props.aiSearch' | t }}</span>
          </button>
        </div>
        @if (aiResult(); as r) {
          <div class="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-2.5 pt-2.5 pb-1 mt-2 animate-fade-up">
            <span class="text-sm text-muted"><span class="ai-text font-semibold">{{ 'props.understood' | t }}</span> {{ r.interpretation }}</span>
            @for (chip of aiChips(); track chip) {
              <span class="chip">{{ chip }}</span>
            }
            @if (r.relaxed) {
              <span class="chip !border-warn/40 !text-warn">{{ 'props.relaxed' | t }}</span>
            }
            <button type="button" class="ml-auto text-xs text-faint hover:text-fg" (click)="clearAi()">{{ 'props.clear' | t }}</button>
          </div>
        } @else if (!aiLoading()) {
          <div class="flex flex-wrap gap-1.5 px-2.5 pt-2 pb-1">
            @for (ex of examples; track ex) {
              <button type="button" class="chip chip-toggle" (click)="aiQuery.set(t(ex)); aiSearch()">{{ ex | t }}</button>
            }
          </div>
        }
        @if (aiError()) {
          <p class="px-2.5 pt-2 text-sm text-bad">{{ aiError() }}</p>
        }
      </form>

      <!-- Classic filters -->
      @if (!aiResult()) {
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative min-w-52 flex-1 sm:max-w-xs">
            <app-icon name="search" [size]="15" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
            <input class="input !pl-9" [placeholder]="'props.searchPlaceholder' | t" [ngModel]="q()" (ngModelChange)="q.set($event)" name="q" [attr.aria-label]="'common.search' | t" />
          </div>
          <select class="input !w-auto" [ngModel]="operation()" (ngModelChange)="operation.set($event)" [attr.aria-label]="'props.operation' | t">
            <option value="">{{ 'props.anyOperation' | t }}</option>
            <option value="venta">{{ 'operation.venta' | t }}</option>
            <option value="alquiler">{{ 'operation.alquiler' | t }}</option>
          </select>
          <select class="input !w-auto" [ngModel]="type()" (ngModelChange)="type.set($event)" [attr.aria-label]="'props.type' | t">
            <option value="">{{ 'props.allTypes' | t }}</option>
            @for (pt of types; track pt) {
              <option [value]="pt">{{ pt | label: 'type' }}</option>
            }
          </select>
          <select class="input !w-auto" [ngModel]="status()" (ngModelChange)="status.set($event)" [attr.aria-label]="'props.status' | t">
            <option value="">{{ 'props.allStatuses' | t }}</option>
            @for (s of statuses; track s) {
              <option [value]="s">{{ s | label: 'status' }}</option>
            }
          </select>
          <select class="input !w-auto" [ngModel]="city()" (ngModelChange)="city.set($event)" [attr.aria-label]="'props.city' | t">
            <option value="">{{ 'props.allCities' | t }}</option>
            @for (c of cities(); track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
          <select class="input !w-auto" [ngModel]="sort()" (ngModelChange)="sort.set($event)" [attr.aria-label]="'props.sort' | t">
            <option value="recent">{{ 'props.sortRecent' | t }}</option>
            <option value="price_asc">{{ 'props.sortPriceAsc' | t }}</option>
            <option value="price_desc">{{ 'props.sortPriceDesc' | t }}</option>
            <option value="area_desc">{{ 'props.sortArea' | t }}</option>
          </select>
        </div>
      }

      <div class="flex items-center justify-end gap-1">
        @for (v of views; track v.id) {
          <button
            class="btn btn-sm btn-icon"
            [class]="view() === v.id ? 'btn-ghost !bg-white/10' : 'btn-ghost !border-transparent text-faint'"
            (click)="setView(v.id)"
            [attr.aria-label]="v.label | t"
            [title]="v.label | t"
          >
            <app-icon [name]="v.icon" [size]="16" />
          </button>
        }
      </div>

      @if (loading() && !items().length) {
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) {
            <div class="shimmer aspect-[4/5]"></div>
          }
        </div>
      } @else if (!items().length) {
        <div class="panel flex flex-col items-center p-12 text-center">
          <app-icon name="building" [size]="36" class="text-faint" />
          <p class="mt-3 font-medium">{{ 'props.empty' | t }}</p>
          <p class="mt-1 text-sm text-muted">{{ 'props.emptyHint' | t }}</p>
          <button class="btn btn-ghost mt-5" (click)="copilot.open(t('props.alternativesPrompt', { query: aiQuery() || q() || t('props.mySearch') }))">
            <app-icon name="sparkles" class="text-violet-soft" [size]="16" /> {{ 'props.askAi' | t }}
          </button>
        </div>
      } @else {
        @switch (view()) {
          @case ('grid') {
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" [class.opacity-60]="loading()">
              @for (p of items(); track p.id) {
                <app-property-card class="animate-fade-up" [property]="p" />
              }
            </div>
          }
          @case ('list') {
            <div class="panel divide-y divide-[var(--line)] overflow-hidden" [class.opacity-60]="loading()">
              @for (p of items(); track p.id) {
                <a [routerLink]="['/properties', p.id]" class="flex items-center gap-4 px-4 py-3 transition hover:bg-white/[0.03]">
                  <app-photo class="h-14 w-20 shrink-0 rounded-lg" [src]="p.images[0]" />
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">{{ p.title }}</p>
                    <p class="text-xs text-muted">{{ p.reference }} · {{ p.type | label: 'type' }} · {{ p.district ? p.district + ', ' : '' }}{{ p.city }}</p>
                  </div>
                  <span class="hidden text-xs text-muted md:block">{{ p.area }} m² · {{ 'props.beds' | t: { n: p.bedrooms } }}</span>
                  <app-status-badge class="hidden sm:block" [value]="p.status" />
                  <span class="w-32 text-right text-sm font-semibold">{{ p.price | eur: p.operation }}</span>
                </a>
              }
            </div>
          }
          @case ('map') {
            <app-properties-map class="h-[70vh]" [properties]="items()" />
          }
        }
      }
    </div>
  `,
})
export class PropertiesList implements OnInit {
  private readonly api = inject(Api);
  protected readonly copilot = inject(CopilotStore);

  protected readonly t = translate;
  protected readonly examples = EXAMPLES;
  protected readonly types = PROPERTY_TYPES;
  protected readonly statuses: PropertyStatus[] = ['disponible', 'reservado', 'borrador', 'vendido', 'alquilado'];
  protected readonly views: { id: View; icon: string; label: TKey }[] = [
    { id: 'grid', icon: 'grid', label: 'props.viewGrid' },
    { id: 'list', icon: 'list', label: 'props.viewList' },
    { id: 'map', icon: 'map', label: 'props.viewMap' },
  ];

  protected readonly q = signal('');
  protected readonly operation = signal<Operation | ''>('');
  protected readonly type = signal<PropertyType | ''>('');
  protected readonly status = signal<PropertyStatus | ''>('');
  protected readonly city = signal('');
  protected readonly sort = signal<NonNullable<PropertyFilters['sort']>>('recent');
  protected readonly view = signal<View>(this.storedView());

  protected readonly items = signal<Property[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly cities = signal<string[]>([]);

  protected readonly aiQuery = signal('');
  protected readonly aiLoading = signal(false);
  protected readonly aiError = signal<string | null>(null);
  protected readonly aiResult = signal<AiSearchResult | null>(null);

  protected readonly aiChips = computed(() => {
    const f = this.aiResult()?.filters;
    if (!f) return [];
    const chips: string[] = [];
    const t = translate;
    if (f.operation) chips.push(t(`operation.${f.operation}` as const));
    f.types?.forEach((type) => chips.push(label('type', type)));
    [...(f.cities ?? []), ...(f.districts ?? [])].forEach((c) => chips.push(c));
    if (f.priceMin) chips.push(t('common.from', { value: eur(f.priceMin) }));
    if (f.priceMax) chips.push(t('common.upTo', { value: eur(f.priceMax) }));
    if (f.minBedrooms) chips.push(t('props.minBeds', { n: f.minBedrooms }));
    if (f.minArea) chips.push(`${f.minArea}+ m²`);
    f.features?.forEach((x) => chips.push(featureLabel(x)));
    if (f.q) chips.push(`«${f.q}»`);
    return chips;
  });

  private debounce?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const filters: PropertyFilters = {
        q: this.q() || undefined,
        operation: this.operation() || undefined,
        types: this.type() ? [this.type() as PropertyType] : undefined,
        statuses: this.status() ? [this.status() as PropertyStatus] : undefined,
        cities: this.city() ? [this.city()] : undefined,
        sort: this.sort(),
      };
      untracked(() => {
        clearTimeout(this.debounce);
        this.debounce = setTimeout(() => this.load(filters), 220);
      });
    });
    effect(() => {
      // Refresh when the copilot modifies properties.
      if (this.copilot.dataVersion() > 0) untracked(() => this.aiResult() ? this.aiSearch() : this.load({ sort: this.sort() }));
    });
  }

  async ngOnInit() {
    try {
      this.cities.set((await this.api.locations()).map((l) => l.city));
    } catch {
      // Non-critical.
    }
  }

  private async load(filters: PropertyFilters) {
    if (this.aiResult()) return;
    this.loading.set(true);
    try {
      const res = await this.api.properties({ ...filters, limit: 120 });
      this.items.set(res.items);
      this.total.set(res.total);
    } finally {
      this.loading.set(false);
    }
  }

  async aiSearch(event?: Event) {
    event?.preventDefault();
    const query = this.aiQuery().trim();
    if (query.length < 3) return;
    this.aiLoading.set(true);
    this.aiError.set(null);
    try {
      const result = await this.api.aiSearch(query);
      this.aiResult.set(result);
      this.items.set(result.items);
      this.total.set(result.total);
    } catch (err) {
      this.aiError.set(errorMessage(err));
    } finally {
      this.aiLoading.set(false);
    }
  }

  clearAi() {
    this.aiResult.set(null);
    this.aiQuery.set('');
    void this.load({ sort: this.sort() });
  }

  setView(view: View) {
    this.view.set(view);
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // ignore
    }
  }

  private storedView(): View {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === 'list' || v === 'map' ? v : 'grid';
    } catch {
      return 'grid';
    }
  }
}
