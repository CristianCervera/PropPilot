import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { EurPipe, LabelPipe, PROPERTY_STATUS_COLOR, CLIENT_STATUS_COLOR } from '../core/format';
import { TPipe } from '../core/i18n';
import { ClientStatus, Operation, PropertyStatus } from '../core/models';
import { Icon } from './icon';

/** Image with a branded gradient placeholder when missing or broken. */
@Component({
  selector: 'app-photo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block overflow-hidden bg-ink-800' },
  imports: [Icon],
  template: `
    @if (src() && !failed()) {
      <img
        [src]="src()"
        [alt]="alt()"
        loading="lazy"
        class="h-full w-full object-cover"
        (error)="failed.set(true)"
      />
    } @else {
      <div class="grid h-full w-full place-items-center bg-gradient-to-br from-ink-700 via-ink-800 to-magenta/15 text-faint">
        <app-icon name="building" [size]="28" />
      </div>
    }
  `,
})
export class Photo {
  readonly src = input<string | null | undefined>(null);
  readonly alt = input('');
  protected readonly failed = signal(false);
}

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LabelPipe],
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full bg-ink-950/75 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur"
      [style.color]="'color-mix(in oklab, ' + color() + ', var(--color-fg) var(--badge-mix))'"
      [style.border]="'1px solid ' + color() + '55'"
    >
      <span class="size-1.5 rounded-full" [style.background]="color()"></span>
      {{ value() | label: (kind() === 'client' ? 'clientStatus' : 'status') }}
    </span>
  `,
})
export class StatusBadge {
  readonly value = input.required<string>();
  readonly kind = input<'property' | 'client'>('property');
  protected readonly color = computed(() =>
    this.kind() === 'client'
      ? CLIENT_STATUS_COLOR[this.value() as ClientStatus]
      : PROPERTY_STATUS_COLOR[this.value() as PropertyStatus],
  );
}

export interface CardProperty {
  id: number;
  title: string;
  price: number;
  operation: Operation;
  status: PropertyStatus;
  city: string;
  district: string | null;
  bedrooms: number;
  area: number;
  bathrooms?: number;
  image?: string | null;
  images?: string[];
  reference?: string;
  highlighted?: boolean;
  score?: number;
}

@Component({
  selector: 'app-property-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Photo, StatusBadge, Icon, EurPipe, TPipe],
  template: `
    @let p = property();
    <a
      [routerLink]="['/properties', p.id]"
      class="group panel-flat flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[0_18px_40px_-20px_rgb(139_92_246/0.6)]"
    >
      <div class="relative" [class]="compact() ? 'aspect-[16/9]' : 'aspect-[4/3]'">
        <app-photo class="h-full w-full transition duration-500 group-hover:scale-[1.03]" [src]="p.image ?? p.images?.[0]" [alt]="p.title" />
        <div class="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <app-status-badge [value]="p.status" />
          @if (p.score != null) {
            <span class="ai-surface rounded-full px-2 py-0.5 text-[11px] font-bold">
              <span class="ai-text">{{ 'card.match' | t: { n: p.score } }}</span>
            </span>
          } @else if (p.highlighted) {
            <span class="grid size-7 place-items-center rounded-full bg-black/40 text-warn backdrop-blur">
              <app-icon name="star" [size]="14" />
            </span>
          }
        </div>
        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pt-8 pb-2.5">
          <p class="h-display text-lg font-semibold text-white">{{ p.price | eur: p.operation }}</p>
        </div>
      </div>
      <div class="flex flex-1 flex-col gap-2 p-3.5">
        <h3 class="line-clamp-2 text-sm font-semibold leading-snug">{{ p.title }}</h3>
        <p class="flex items-center gap-1 text-xs text-muted">
          <app-icon name="pin" [size]="13" /> {{ p.district ? p.district + ', ' : '' }}{{ p.city }}
        </p>
        <div class="mt-auto flex items-center gap-3 pt-1 text-xs text-muted">
          @if (p.bedrooms) {
            <span class="flex items-center gap-1"><app-icon name="bed" [size]="14" />{{ p.bedrooms }}</span>
          }
          @if (p.bathrooms) {
            <span class="flex items-center gap-1"><app-icon name="bath" [size]="14" />{{ p.bathrooms }}</span>
          }
          <span class="flex items-center gap-1"><app-icon name="ruler" [size]="14" />{{ p.area }} m²</span>
          <span class="ml-auto text-faint">{{ p.reference }}</span>
        </div>
      </div>
    </a>
  `,
})
export class PropertyCardView {
  readonly property = input.required<CardProperty>();
  readonly compact = input(false);
}

/** Lightweight modal dialog with backdrop and Escape to close. */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TPipe],
  host: { '(document:keydown.escape)': 'open() && close()' },
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" (click)="close()">
        <div
          class="panel animate-fade-up flex max-h-[92vh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-b-[1.1rem]"
          [style.max-width]="width()"
          (click)="$event.stopPropagation()"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
        >
          <header class="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4">
            <h2 class="h-display flex-1 text-lg font-semibold">{{ title() }}</h2>
            <button class="btn btn-ghost btn-sm btn-icon" (click)="close()" [attr.aria-label]="'common.close' | t">
              <app-icon name="x" [size]="16" />
            </button>
          </header>
          <div class="overflow-y-auto p-5"><ng-content /></div>
        </div>
      </div>
    }
  `,
})
export class Modal {
  readonly open = model(false);
  readonly title = input('');
  readonly width = input('560px');
  readonly closed = output();
  close() {
    this.open.set(false);
    this.closed.emit();
  }
}

/** Placeholder shown while an AI request is running. */
@Component({
  selector: 'app-ai-thinking',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TPipe],
  template: `
    <div class="flex items-center gap-2 text-sm text-muted">
      <app-icon name="sparkles" class="animate-pulse text-violet-soft" />
      <span>{{ label() ?? ('common.aiThinking' | t) }}</span>
      <span class="flex gap-1">
        @for (i of [0, 1, 2]; track i) {
          <span class="size-1 rounded-full bg-violet-soft" [style.animation]="'pulse-dot 1.2s ' + i * 0.15 + 's infinite'"></span>
        }
      </span>
    </div>
    <div class="mt-4 space-y-2">
      <div class="shimmer h-3 w-11/12"></div>
      <div class="shimmer h-3 w-9/12"></div>
      <div class="shimmer h-3 w-10/12"></div>
    </div>
  `,
})
export class AiThinking {
  readonly label = input<string | null>(null);
}
