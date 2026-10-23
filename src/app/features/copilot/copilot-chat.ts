import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EurPipe, LabelPipe } from '../../core/format';
import { DatePipeI18n, TKey, TPipe, translate, translateOr } from '../../core/i18n';
import { ChatPart } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Markdown } from '../../shared/markdown';
import { Photo } from '../../shared/ui';
import { CopilotStore } from './copilot.store';

const SUGGESTIONS: TKey[] = ['chat.suggestion1', 'chat.suggestion2', 'chat.suggestion3', 'chat.suggestion4'];

@Component({
  selector: 'app-copilot-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DatePipeI18n, TPipe, Icon, Markdown, Photo, EurPipe, LabelPipe],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  template: `
    <div #scroller class="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
      @if (!store.turns().length) {
        <div class="mx-auto flex max-w-md flex-col items-center pt-6 text-center animate-fade-up">
          <img src="logo.webp" alt="" class="size-20 rounded-2xl shadow-[0_10px_40px_-10px_rgb(192_79_216/0.8)]" />
          <h3 class="h-display mt-4 text-xl font-semibold">{{ 'chat.welcome' | t }}</h3>
          <p class="mt-1.5 text-sm text-muted">
            {{ 'chat.intro' | t }}
          </p>
          <div class="mt-6 grid w-full gap-2">
            @for (s of suggestions; track s) {
              <button class="panel-flat flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-muted transition hover:border-[var(--line-strong)] hover:text-fg" (click)="store.send(t(s))">
                <app-icon name="sparkles" [size]="15" class="text-violet-soft" /> {{ s | t }}
              </button>
            }
          </div>
        </div>
      }

      <div class="space-y-5">
        @for (turn of store.turns(); track $index; let last = $last) {
          @if (turn.role === 'user') {
            <div class="flex justify-end animate-fade-up">
              <p class="max-w-[85%] rounded-2xl rounded-br-md bg-ink-700 px-3.5 py-2.5 text-sm whitespace-pre-wrap">{{ turn.parts[0]?.type === 'text' ? $any(turn.parts[0]).text : '' }}</p>
            </div>
          } @else {
            <div class="flex gap-3 animate-fade-up">
              <img src="logo.webp" alt="" class="mt-0.5 size-7 shrink-0 rounded-lg" />
              <div class="min-w-0 flex-1 space-y-2.5">
                @for (part of turn.parts; track $index) {
                  @switch (part.type) {
                    @case ('thinking') {
                      <details class="group text-xs text-faint">
                        <summary class="flex cursor-pointer list-none items-center gap-1.5 hover:text-muted">
                          <app-icon name="brain" [size]="13" /> {{ 'chat.reasoning' | t }}
                          <app-icon name="chevron-down" [size]="12" class="transition group-open:rotate-180" />
                        </summary>
                        <p class="mt-1.5 border-l border-[var(--line-strong)] pl-3 leading-relaxed whitespace-pre-wrap">{{ part.text }}</p>
                      </details>
                    }
                    @case ('text') {
                      <app-markdown [text]="part.text" />
                    }
                    @case ('tool') {
                      <div class="flex items-center gap-2 text-xs" [class.text-faint]="!part.pending" [class.text-muted]="part.pending">
                        @if (part.pending) {
                          <span class="size-3.5 animate-spin rounded-full border-2 border-violet-soft border-t-transparent"></span>
                        } @else {
                          <app-icon [name]="part.ok === false ? 'alert' : 'check'" [size]="13" [class]="part.ok === false ? 'text-bad' : 'text-ok'" />
                        }
                        {{ toolLabel(part) }}
                      </div>
                      @if (part.ui; as ui) {
                        @switch (ui.kind) {
                          @case ('properties') {
                            <div class="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-1">
                              @for (p of ui.items; track p.id) {
                                <a [routerLink]="['/properties', p.id]" class="panel-flat w-52 shrink-0 snap-start overflow-hidden transition hover:border-[var(--line-strong)]">
                                  <app-photo class="aspect-[16/10]" [src]="p.image" [alt]="p.title" />
                                  <div class="p-2.5">
                                    <div class="flex items-center justify-between gap-2">
                                      <p class="text-sm font-semibold">{{ p.price | eur: p.operation }}</p>
                                      @if (p.score != null) {
                                        <span class="ai-text text-xs font-bold">{{ p.score }}%</span>
                                      }
                                    </div>
                                    <p class="mt-0.5 line-clamp-1 text-xs text-muted">{{ p.title }}</p>
                                    <p class="mt-1 text-[11px] text-faint">{{ p.district || p.city }} · {{ p.area }} m² · {{ 'props.beds' | t: { n: p.bedrooms } }}</p>
                                  </div>
                                </a>
                              }
                            </div>
                          }
                          @case ('clients') {
                            <div class="flex flex-wrap gap-2">
                              @for (c of ui.items; track c.id) {
                                <a [routerLink]="['/clients', c.id]" class="panel-flat flex items-center gap-2.5 px-3 py-2 transition hover:border-[var(--line-strong)]">
                                  <span class="grid size-8 place-items-center rounded-full bg-ink-700 text-xs font-bold">{{ initials(c.name) }}</span>
                                  <span class="text-left">
                                    <span class="block text-sm font-medium">{{ c.name }}</span>
                                    <span class="block text-[11px] text-faint">{{ c.status | label: 'clientStatus' }}{{ c.budgetMax ? ' · ' + ('common.upTo' | t: { value: c.budgetMax | eur }) : '' }}</span>
                                  </span>
                                  @if (c.score != null) {
                                    <span class="ai-text ml-1 text-xs font-bold">{{ c.score }}%</span>
                                  }
                                </a>
                              }
                            </div>
                          }
                          @case ('visit') {
                            <a routerLink="/agenda" class="ai-surface flex items-center gap-3 px-3.5 py-2.5 text-sm">
                              <app-icon name="calendar" class="text-violet-soft" />
                              {{ 'agenda.scheduled' | t }} · {{ ui.visit.scheduledAt | d: "EEEE d MMM, HH:mm" }}
                            </a>
                          }
                        }
                      }
                    }
                  }
                }
                @if (last && store.streaming() && !turn.parts.length) {
                  <div class="flex items-center gap-1.5 py-2">
                    @for (i of [0, 1, 2]; track i) {
                      <span class="size-1.5 rounded-full bg-violet-soft" [style.animation]="'pulse-dot 1.2s ' + i * 0.15 + 's infinite'"></span>
                    }
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>

      @if (store.error(); as error) {
        <div class="mt-4 flex items-start gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">
          <app-icon name="alert" [size]="16" class="mt-0.5" /> {{ error }}
        </div>
      }
    </div>

    <form class="border-t border-[var(--line)] p-3 sm:p-4" (submit)="submit($event)">
      <div class="ai-surface flex items-end gap-2 p-1.5 pl-3.5">
        <textarea
          #box
          rows="1"
          class="max-h-40 min-h-[2.4rem] flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-faint"
          [placeholder]="'chat.placeholder' | t"
          [(ngModel)]="draft"
          name="draft"
          (keydown.enter)="onEnter($event)"
          (input)="autosize()"
          [attr.aria-label]="'chat.aria' | t"
        ></textarea>
        @if (store.streaming()) {
          <button type="button" class="btn btn-ghost btn-icon" (click)="store.stop()" [attr.aria-label]="'chat.stop' | t">
            <span class="size-3 rounded-sm bg-fg"></span>
          </button>
        } @else {
          <button type="submit" class="btn btn-primary btn-icon" [disabled]="!draft().trim()" [attr.aria-label]="'chat.send' | t">
            <app-icon name="arrow-up" [size]="18" />
          </button>
        }
      </div>
      <p class="mt-2 text-center text-[11px] text-faint">{{ 'chat.disclaimer' | t }}</p>
    </form>
  `,
})
export class CopilotChat {
  protected readonly store = inject(CopilotStore);
  protected readonly t = translate;
  protected readonly suggestions = SUGGESTIONS;
  protected readonly draft = signal('');
  readonly autofocus = input(false);

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly box = viewChild.required<ElementRef<HTMLTextAreaElement>>('box');

  constructor() {
    effect(() => {
      this.store.turns();
      const el = this.scroller().nativeElement;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      if (nearBottom || this.store.streaming()) queueMicrotask(() => el.scrollTo({ top: el.scrollHeight }));
    });
    effect(() => {
      if (this.autofocus()) setTimeout(() => this.box().nativeElement.focus(), 50);
    });
  }

  protected toolLabel(part: Extract<ChatPart, { type: 'tool' }>) {
    const running = translateOr(`tool.${part.name}.running`, part.name);
    const done = translateOr(`tool.${part.name}.done`, part.name);
    if (part.ok === false) return translate('chat.toolFailed', { tool: done });
    return part.pending ? `${running}…` : done;
  }

  protected initials = (name: string) =>
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  protected onEnter(event: Event) {
    const e = event as KeyboardEvent;
    if (!e.shiftKey) this.submit(e);
  }

  protected submit(event: Event) {
    event.preventDefault();
    const text = this.draft();
    if (!text.trim() || this.store.streaming()) return;
    this.draft.set('');
    queueMicrotask(() => this.autosize());
    void this.store.send(text);
  }

  protected autosize() {
    const el = this.box().nativeElement;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }
}
