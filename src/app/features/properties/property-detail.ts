import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { EurPipe, LabelPipe, PROPERTY_STATUSES, eur, label } from '../../core/format';
import { DatePipeI18n, TDynPipe, TKey, TPipe, currentLang, formatDateLocal, translate } from '../../core/i18n';
import { Client, Listing, MatchInfo, Pitch, PropertyDetail, PropertyStatus, Valuation } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Toasts } from '../../shared/toast';
import { AiThinking, Modal, Photo, StatusBadge } from '../../shared/ui';
import { CopilotStore } from '../copilot/copilot.store';
import { PropertiesMap } from './properties-map';

type Tab = 'valuation' | 'listing' | 'matches';

@Component({
  selector: 'app-property-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule, DatePipeI18n, TPipe, TDynPipe, Icon, Photo, StatusBadge, AiThinking, Modal, PropertiesMap, EurPipe, LabelPipe],
  template: `
    @if (property(); as p) {
      <div class="space-y-6 animate-fade-up">
        <!-- Header -->
        <div class="flex flex-wrap items-start gap-4">
          <a routerLink="/properties" class="btn btn-ghost btn-icon" [attr.aria-label]="'common.back' | t"><app-icon name="chevron-left" /></a>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2 text-xs text-faint">
              <span>{{ p.reference }}</span>·<span>{{ p.type | label: 'type' }} · {{ 'operation.' + p.operation | td }}</span>
              <app-status-badge [value]="p.status" />
            </div>
            <h1 class="h-display mt-1.5 text-2xl font-semibold sm:text-3xl">{{ p.title }}</h1>
            <p class="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <app-icon name="pin" [size]="15" /> {{ p.address ? p.address + ', ' : '' }}{{ p.district ? p.district + ', ' : '' }}{{ p.city }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <select class="input !h-10 !w-auto" [ngModel]="p.status" (ngModelChange)="changeStatus($event)" [attr.aria-label]="'detail.changeStatus' | t">
              @for (s of statuses; track s) {
                <option [value]="s">{{ s | label: 'status' }}</option>
              }
            </select>
            <a [routerLink]="['/properties', p.id, 'edit']" class="btn btn-ghost"><app-icon name="edit" [size]="15" /> {{ 'common.edit' | t }}</a>
            <button class="btn btn-ghost btn-icon text-bad" (click)="confirmDelete.set(true)" [attr.aria-label]="'common.delete' | t"><app-icon name="trash" [size]="16" /></button>
          </div>
        </div>

        <!-- Gallery -->
        <div class="grid gap-2 overflow-hidden rounded-[1.1rem] md:h-[440px] md:grid-rows-2" [class]="galleryCols()">
          <app-photo class="aspect-[16/10] cursor-zoom-in md:row-span-2 md:aspect-auto" [class.md:col-span-2]="p.images.length >= 4" [src]="p.images[0]" [alt]="p.title" (click)="lightbox.set(0)" />
          @for (img of p.images.slice(1, 5); track img; let i = $index) {
            <app-photo
              class="hidden cursor-zoom-in md:block"
              [class.md:row-span-2]="p.images.length === 2"
              [class.md:col-span-2]="p.images.length === 4 && i === 2"
              [src]="img"
              (click)="lightbox.set(i + 1)"
            />
          }
        </div>

        <div class="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div class="space-y-6">
            <!-- Key facts -->
            <section class="panel grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-px overflow-hidden">
              @for (f of facts(); track f.label) {
                <div class="bg-ink-900/40 p-4">
                  <p class="label">{{ f.label | t }}</p>
                  <p class="h-display mt-1.5 text-lg font-semibold">{{ f.value }}</p>
                </div>
              }
            </section>

            <section class="panel p-5 sm:p-6">
              <h2 class="h-display font-semibold">{{ 'detail.description' | t }}</h2>
              @if (p.description) {
                <p class="mt-3 leading-relaxed whitespace-pre-line text-muted">{{ p.description }}</p>
              } @else {
                <div class="mt-3 flex flex-wrap items-center gap-3">
                  <p class="flex-1 text-sm text-faint">{{ 'detail.noDescription' | t }}</p>
                  <button class="btn btn-primary btn-sm" (click)="tab.set('listing'); generateListing()"><app-icon name="wand" [size]="14" /> {{ 'detail.writeWithAi' | t }}</button>
                </div>
              }
              @if (p.features.length) {
                <div class="mt-5 flex flex-wrap gap-2">
                  @for (f of p.features; track f) {
                    <span class="chip"><app-icon name="check" [size]="12" class="text-ok" /> {{ f | label: 'feature' }}</span>
                  }
                </div>
              }
            </section>

            @if (p.lat && p.lng) {
              <app-properties-map class="h-72" [properties]="[p]" [single]="true" />
            }

            <section class="panel p-5 sm:p-6">
              <div class="flex items-center justify-between">
                <h2 class="h-display font-semibold">{{ 'detail.visits' | t }}</h2>
                <a routerLink="/agenda" [queryParams]="{ propertyId: p.id }" class="btn btn-ghost btn-sm"><app-icon name="plus" [size]="14" /> {{ 'detail.schedule' | t }}</a>
              </div>
              <ul class="mt-3 divide-y divide-[var(--line)]">
                @for (v of p.visits; track v.id) {
                  <li class="py-3 text-sm">
                    <div class="flex items-center gap-3">
                      <span class="w-32 shrink-0 text-muted">{{ v.scheduledAt | d: 'd MMM y, HH:mm' }}</span>
                      <a [routerLink]="['/clients', v.client.id]" class="flex-1 font-medium hover:underline">{{ v.client.name }}</a>
                      <span class="chip">{{ v.status | label: 'visitStatus' }}</span>
                    </div>
                    @if (v.feedback) {
                      <p class="mt-1.5 pl-35 text-xs text-muted">«{{ v.feedback }}»</p>
                    }
                  </li>
                } @empty {
                  <li class="py-4 text-sm text-faint">{{ 'detail.noVisits' | t }}</li>
                }
              </ul>
            </section>
          </div>

          <!-- AI side panel -->
          <aside class="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <div class="panel p-5">
              <p class="label">{{ 'detail.listedPrice' | t }}</p>
              <p class="h-display mt-1 text-3xl font-semibold">{{ p.price | eur: p.operation }}</p>
              <p class="mt-1 text-sm text-muted">{{ pricePerM2() }}/m²</p>
              @if (p.owner) {
                <a [routerLink]="['/clients', p.owner.id]" class="mt-4 flex items-center gap-2 text-sm text-muted hover:text-fg">
                  <app-icon name="users" [size]="15" /> {{ 'detail.owner' | t: { name: p.owner.name } }}
                </a>
              }
            </div>

            <div class="ai-surface overflow-hidden">
              <div class="flex border-b border-[var(--line)]" role="tablist">
                @for (tb of tabs; track tb.id) {
                  <button
                    role="tab"
                    class="flex flex-1 items-center justify-center gap-1.5 px-2 py-3 text-xs font-semibold transition"
                    [class]="tab() === tb.id ? 'bg-tint/[0.06] text-fg' : 'text-faint hover:text-muted'"
                    [attr.aria-selected]="tab() === tb.id"
                    (click)="tab.set(tb.id)"
                  >
                    <app-icon [name]="tb.icon" [size]="14" /> {{ tb.label | t }}
                  </button>
                }
              </div>
              <div class="p-5">
                @switch (tab()) {
                  @case ('valuation') {
                    @if (valuationLoading()) {
                      <app-ai-thinking [label]="'detail.valuing' | t" />
                    } @else if (valuation(); as v) {
                      <div class="animate-fade-up">
                        <div class="flex items-start justify-between gap-3">
                          <div>
                            <p class="label">{{ 'detail.estimated' | t }}</p>
                            <p class="h-display ai-text mt-1 text-3xl font-bold">{{ v.estimatedPrice | eur }}</p>
                            <p class="text-xs text-muted">{{ 'detail.range' | t: { low: v.rangeLow | eur, high: v.rangeHigh | eur } }}</p>
                          </div>
                          <span class="chip" [style.color]="verdictColor()">{{ 'verdict.' + v.verdict | td }}</span>
                        </div>
                        <!-- Range bar with published price marker -->
                        <div class="relative mt-5 h-2 rounded-full bg-gradient-to-r from-violet/40 via-violet to-magenta">
                          <span class="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-ink-900 bg-white shadow" [style.left.%]="markerPct()" [title]="'detail.listedPrice' | t"></span>
                        </div>
                        <div class="mt-1.5 flex justify-between text-[11px] text-faint">
                          <span>{{ v.rangeLow | eur }}</span><span>{{ 'detail.listed' | t: { price: p.price | eur } }}</span><span>{{ v.rangeHigh | eur }}</span>
                        </div>
                        <p class="mt-4 text-sm leading-relaxed text-muted">{{ v.summary }}</p>
                        <ul class="mt-4 space-y-2">
                          @for (f of v.factors; track f.factor) {
                            <li class="flex gap-2.5 text-sm">
                              <app-icon
                                [name]="f.impact === 'positivo' ? 'trending-up' : f.impact === 'negativo' ? 'trending-down' : 'arrow-right'"
                                [size]="15"
                                class="mt-0.5"
                                [class]="f.impact === 'positivo' ? 'text-ok' : f.impact === 'negativo' ? 'text-bad' : 'text-faint'"
                              />
                              <span><strong class="font-medium">{{ f.factor }}.</strong> <span class="text-muted">{{ f.detail }}</span></span>
                            </li>
                          }
                        </ul>
                        <div class="mt-4 rounded-xl bg-tint/[0.04] p-3 text-sm">
                          <p class="label mb-1">{{ 'detail.recommendation' | t }}</p>
                          {{ v.recommendation }}
                        </div>
                        <div class="mt-4 flex items-center justify-between text-[11px] text-faint">
                          <span>{{ 'detail.confidence' | t: { level: ('confidence.' + v.confidence | td) } }} · {{ v.generatedAt | d: 'd MMM, HH:mm' }}</span>
                          <button class="hover:text-fg" (click)="runValuation()">{{ 'detail.recalculate' | t }}</button>
                        </div>
                      </div>
                    } @else {
                      <p class="text-sm text-muted">{{ 'detail.valuationIntro' | t }}</p>
                      <button class="btn btn-primary mt-4 w-full" (click)="runValuation()"><app-icon name="sparkles" [size]="16" /> {{ 'detail.valueWithAi' | t }}</button>
                    }
                    @if (valuationError()) {
                      <p class="mt-3 text-sm text-bad">{{ valuationError() }}</p>
                    }
                  }
                  @case ('listing') {
                    <div class="grid grid-cols-2 gap-2">
                      <select class="input" [(ngModel)]="tone" [attr.aria-label]="'detail.tone' | t">
                        <option value="premium">{{ 'detail.tonePremium' | t }}</option>
                        <option value="cercano">{{ 'detail.toneFriendly' | t }}</option>
                        <option value="familiar">{{ 'detail.toneFamily' | t }}</option>
                        <option value="inversor">{{ 'detail.toneInvestor' | t }}</option>
                      </select>
                      <select class="input" [(ngModel)]="language" [attr.aria-label]="'common.language' | t">
                        <option value="español">{{ 'lang.es' | t }}</option>
                        <option value="inglés">{{ 'lang.en' | t }}</option>
                        <option value="alemán">{{ 'lang.de' | t }}</option>
                        <option value="francés">{{ 'lang.fr' | t }}</option>
                      </select>
                    </div>
                    <label class="mt-3 flex items-center gap-2 text-sm text-muted">
                      <input type="checkbox" class="accent-violet" [(ngModel)]="usePhotos" /> {{ 'detail.analyzePhotos' | t: { n: p.images.length } }}
                    </label>
                    <button class="btn btn-primary mt-4 w-full" (click)="generateListing()" [disabled]="listingLoading()">
                      <app-icon name="wand" [size]="16" /> {{ (listing() ? 'detail.regenerateListing' : 'detail.generateListing') | t }}
                    </button>
                    <div class="mt-5">
                      @if (listingLoading()) {
                        <app-ai-thinking [label]="'detail.writing' | t" />
                      } @else if (listing(); as l) {
                        <div class="space-y-4 animate-fade-up">
                          <div>
                            <p class="label">{{ 'detail.title' | t }}</p>
                            <p class="mt-1 font-semibold">{{ l.title }}</p>
                          </div>
                          <div>
                            <p class="label">{{ 'detail.description' | t }}</p>
                            <p class="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted">{{ l.description }}</p>
                          </div>
                          <ul class="space-y-1 text-sm">
                            @for (h of l.highlights; track h) {
                              <li class="flex gap-2"><app-icon name="sparkles" [size]="13" class="mt-1 text-violet-soft" /> {{ h }}</li>
                            }
                          </ul>
                          <div class="rounded-xl bg-tint/[0.04] p-3">
                            <div class="flex items-center justify-between"><p class="label">{{ 'detail.socialPost' | t }}</p>
                              <button class="text-faint hover:text-fg" (click)="copy(l.socialPost)" [attr.aria-label]="'common.copy' | t"><app-icon name="copy" [size]="14" /></button>
                            </div>
                            <p class="mt-1 text-sm whitespace-pre-line">{{ l.socialPost }}</p>
                          </div>
                          @if (l.photoInsights.length) {
                            <div>
                              <p class="label">{{ 'detail.aboutPhotos' | t }}</p>
                              <ul class="mt-1 list-disc space-y-1 pl-4 text-xs text-muted">
                                @for (i of l.photoInsights; track i) {
                                  <li>{{ i }}</li>
                                }
                              </ul>
                            </div>
                          }
                          <div class="flex flex-wrap gap-1.5">
                            @for (k of l.seoKeywords; track k) {
                              <span class="chip">{{ k }}</span>
                            }
                          </div>
                          <button class="btn btn-ghost w-full" (click)="applyListing(l)"><app-icon name="check" [size]="15" /> {{ 'detail.applyListing' | t }}</button>
                        </div>
                      }
                      @if (listingError()) {
                        <p class="text-sm text-bad">{{ listingError() }}</p>
                      }
                    </div>
                  }
                  @case ('matches') {
                    <p class="text-sm text-muted">{{ 'detail.matchesIntro' | t }}</p>
                    <ul class="mt-4 space-y-2">
                      @for (m of matches(); track m.client.id) {
                        <li class="panel-flat p-3">
                          <div class="flex items-center gap-3">
                            <span class="ai-text w-10 text-lg font-bold">{{ m.score }}</span>
                            <a [routerLink]="['/clients', m.client.id]" class="min-w-0 flex-1">
                              <span class="block truncate text-sm font-medium hover:underline">{{ m.client.name }}</span>
                              <span class="block text-[11px] text-faint">{{ m.client.status | label: 'clientStatus' }}{{ m.client.budgetMax ? ' · ' + ('common.upTo' | t: { value: m.client.budgetMax | eur }) : '' }}</span>
                            </a>
                            <button class="btn btn-ghost btn-sm" (click)="openPitch(m.client)" [title]="'detail.pitchTitle' | t"><app-icon name="message" [size]="14" /></button>
                          </div>
                          <div class="mt-2 flex flex-wrap gap-1">
                            @for (r of m.reasons; track $index) {
                              <span class="rounded-md bg-ok/10 px-1.5 py-0.5 text-[11px] text-ok">{{ r }}</span>
                            }
                            @for (r of m.mismatches; track $index) {
                              <span class="rounded-md bg-bad/10 px-1.5 py-0.5 text-[11px] text-bad">{{ r }}</span>
                            }
                          </div>
                        </li>
                      } @empty {
                        <li class="text-sm text-faint">{{ 'detail.noMatches' | t }}</li>
                      }
                    </ul>
                    <button class="btn btn-ghost mt-4 w-full" (click)="copilot.open(t('detail.contactPlanPrompt', { id: p.id }))">
                      <app-icon name="sparkles" [size]="15" class="text-violet-soft" /> {{ 'detail.contactPlan' | t }}
                    </button>
                  }
                }
              </div>
            </div>
          </aside>
        </div>
      </div>

      <!-- Pitch modal -->
      <app-modal [(open)]="pitchOpen" [title]="'detail.messageFor' | t: { name: pitchClient()?.name ?? '' }">
        <div class="flex gap-2">
          @for (ch of channels; track ch) {
            <button class="chip chip-toggle" [class.on]="pitchChannel() === ch" (click)="pitchChannel.set(ch); generatePitch()">{{ ch === 'whatsapp' ? 'WhatsApp' : 'Email' }}</button>
          }
        </div>
        <div class="mt-4">
          @if (pitchLoading()) {
            <app-ai-thinking [label]="'detail.personalizing' | t" />
          } @else if (pitch(); as pm) {
            @if (pm.subject) {
              <p class="mb-2 text-sm"><span class="text-faint">{{ 'detail.subject' | t }}</span> {{ pm.subject }}</p>
            }
            <textarea class="input min-h-48" [ngModel]="pm.message" (ngModelChange)="pitch.set({ subject: pm.subject, message: $event })"></textarea>
            <div class="mt-3 flex flex-wrap justify-end gap-2">
              <button class="btn btn-ghost" (click)="copy(pm.message)"><app-icon name="copy" [size]="15" /> {{ 'common.copy' | t }}</button>
              @if (pitchChannel() === 'whatsapp' && pitchClient()?.phone) {
                <a class="btn btn-primary" target="_blank" rel="noopener" [href]="whatsappLink(pm.message)"><app-icon name="send" [size]="15" /> {{ 'detail.openWhatsapp' | t }}</a>
              } @else if (pitchChannel() === 'email' && pitchClient()?.email) {
                <a class="btn btn-primary" [href]="mailtoLink(pm)"><app-icon name="mail" [size]="15" /> {{ 'detail.openEmail' | t }}</a>
              }
            </div>
          } @else if (pitchError()) {
            <p class="text-sm text-bad">{{ pitchError() }}</p>
          }
        </div>
      </app-modal>

      <app-modal [(open)]="confirmDelete" [title]="'detail.deleteTitle' | t" width="420px">
        <p class="text-sm text-muted">{{ 'detail.deleteConfirm' | t: { title: p.title } }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button class="btn btn-ghost" (click)="confirmDelete.set(false)">{{ 'common.cancel' | t }}</button>
          <button class="btn btn-danger" (click)="remove()">{{ 'common.delete' | t }}</button>
        </div>
      </app-modal>

      @if (lightbox() != null) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" (click)="lightbox.set(null)" (document:keydown.escape)="lightbox.set(null)">
          <img [src]="p.images[lightbox()!]" [alt]="p.title" class="max-h-full max-w-full rounded-xl object-contain" (click)="$event.stopPropagation(); nextImage()" />
          <button class="btn btn-ghost btn-icon absolute top-4 right-4" [attr.aria-label]="'common.close' | t"><app-icon name="x" /></button>
          <p class="absolute bottom-4 text-sm text-muted">{{ lightbox()! + 1 }} / {{ p.images.length }}</p>
        </div>
      }
    } @else if (error()) {
      <p class="panel p-8 text-center text-bad">{{ error() }}</p>
    } @else {
      <div class="space-y-4"><div class="shimmer h-10 w-2/3"></div><div class="shimmer h-[440px]"></div></div>
    }
  `,
})
export class PropertyDetailPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  protected readonly copilot = inject(CopilotStore);

  readonly id = input.required<string>();

  protected readonly property = signal<PropertyDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly tab = signal<Tab>('valuation');
  protected readonly t = translate;
  protected readonly tabs: { id: Tab; label: TKey; icon: string }[] = [
    { id: 'valuation', label: 'detail.tabValuation', icon: 'trending-up' },
    { id: 'listing', label: 'detail.tabListing', icon: 'wand' },
    { id: 'matches', label: 'title.clients', icon: 'target' },
  ];
  protected readonly statuses = PROPERTY_STATUSES;
  protected readonly channels = ['whatsapp', 'email'] as const;
  protected readonly lightbox = signal<number | null>(null);
  protected readonly confirmDelete = signal(false);

  protected readonly valuation = signal<Valuation | null>(null);
  protected readonly valuationLoading = signal(false);
  protected readonly valuationError = signal<string | null>(null);

  protected tone = 'premium';
  // Listing language defaults to the UI language; Claude writes the ad in it.
  protected language = currentLang() === 'en' ? 'inglés' : 'español';
  protected usePhotos = true;
  protected readonly listing = signal<Listing | null>(null);
  protected readonly listingLoading = signal(false);
  protected readonly listingError = signal<string | null>(null);

  protected readonly matches = signal<(MatchInfo & { client: Client })[]>([]);
  protected readonly pitchOpen = signal(false);
  protected readonly pitchClient = signal<Client | null>(null);
  protected readonly pitchChannel = signal<'whatsapp' | 'email'>('whatsapp');
  protected readonly pitch = signal<Pitch | null>(null);
  protected readonly pitchLoading = signal(false);
  protected readonly pitchError = signal<string | null>(null);

  /** Grid columns so 1-5 photos always fill the gallery without gaps. */
  protected readonly galleryCols = computed(() => {
    const n = this.property()?.images.length ?? 0;
    return n >= 4 ? 'md:grid-cols-4' : n === 3 ? 'md:grid-cols-[2fr_1fr]' : n === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1';
  });

  protected readonly pricePerM2 = computed(() => {
    const p = this.property();
    return p ? eur(Math.round(p.price / Math.max(p.area, 1))) : '';
  });

  protected readonly facts = computed(() => {
    const p = this.property();
    if (!p) return [];
    const facts: { label: TKey; value: string | number }[] = [
      { label: 'detail.area', value: `${p.area} m²` },
      { label: 'detail.bedrooms', value: p.bedrooms || '—' },
      { label: 'detail.bathrooms', value: p.bathrooms || '—' },
      { label: 'detail.floor', value: p.floor ?? '—' },
      { label: 'detail.year', value: p.yearBuilt ?? '—' },
      { label: 'detail.energy', value: p.energyRating ?? '—' },
      { label: 'detail.postalCode', value: p.postalCode ?? '—' },
      { label: 'detail.listedOn', value: formatDateLocal(p.createdAt, 'd MMM y') },
    ];
    return facts;
  });

  protected readonly markerPct = computed(() => {
    const v = this.valuation();
    const p = this.property();
    if (!v || !p) return 50;
    const span = Math.max(v.rangeHigh - v.rangeLow, 1);
    return Math.min(100, Math.max(0, ((p.price - v.rangeLow) / span) * 100));
  });

  protected readonly verdictColor = computed(
    () => ({ por_debajo: 'var(--color-info)', en_mercado: 'var(--color-ok)', por_encima: 'var(--color-warn)' })[this.valuation()?.verdict ?? 'en_mercado'],
  );

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
      const p = await this.api.property(id);
      this.property.set(p);
      this.valuation.set(p.aiValuation);
      this.matches.set(await this.api.propertyMatches(id));
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }

  async changeStatus(status: PropertyStatus) {
    const p = this.property()!;
    await this.api.updateProperty(p.id, { status });
    this.property.set({ ...p, status });
    this.toasts.show(translate('detail.statusUpdated', { status: label('status', status) }));
  }

  async remove() {
    await this.api.deleteProperty(this.property()!.id);
    this.toasts.show(translate('detail.deleted'));
    void this.router.navigateByUrl('/properties');
  }

  async runValuation() {
    this.valuationLoading.set(true);
    this.valuationError.set(null);
    try {
      this.valuation.set(await this.api.aiValuation(this.property()!.id));
    } catch (err) {
      this.valuationError.set(errorMessage(err));
    } finally {
      this.valuationLoading.set(false);
    }
  }

  async generateListing() {
    this.listingLoading.set(true);
    this.listingError.set(null);
    try {
      this.listing.set(
        await this.api.aiListing(this.property()!.id, { tone: this.tone, language: this.language, usePhotos: this.usePhotos }),
      );
    } catch (err) {
      this.listingError.set(errorMessage(err));
    } finally {
      this.listingLoading.set(false);
    }
  }

  async applyListing(l: Listing) {
    const p = this.property()!;
    const updated = await this.api.updateProperty(p.id, { title: l.title, description: l.description });
    this.property.set({ ...p, title: updated.title, description: updated.description });
    this.toasts.show(translate('detail.listingApplied'), 'ai');
  }

  openPitch(client: Client) {
    this.pitchClient.set(client);
    this.pitch.set(null);
    this.pitchOpen.set(true);
    void this.generatePitch();
  }

  async generatePitch() {
    const client = this.pitchClient();
    if (!client) return;
    this.pitchLoading.set(true);
    this.pitchError.set(null);
    try {
      this.pitch.set(await this.api.aiPitch(this.property()!.id, client.id, this.pitchChannel()));
    } catch (err) {
      this.pitchError.set(errorMessage(err));
    } finally {
      this.pitchLoading.set(false);
    }
  }

  whatsappLink(message: string) {
    const phone = (this.pitchClient()?.phone ?? '').replace(/\D/g, '');
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  mailtoLink(pm: Pitch) {
    return `mailto:${this.pitchClient()?.email}?subject=${encodeURIComponent(pm.subject ?? '')}&body=${encodeURIComponent(pm.message)}`;
  }

  nextImage() {
    const n = this.property()?.images.length ?? 1;
    this.lightbox.update((i) => ((i ?? 0) + 1) % n);
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
