import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18n, LANGS, TPipe } from '../core/i18n';

/** ES | EN segmented toggle. */
@Component({
  selector: 'app-lang-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe],
  template: `
    <div class="inline-flex rounded-lg border border-[var(--line)] bg-white/[0.02] p-0.5" role="group" [attr.aria-label]="'common.language' | t">
      @for (l of langs; track l) {
        <button
          type="button"
          class="rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase transition"
          [class]="i18n.lang() === l ? 'bg-white/10 text-fg' : 'text-faint hover:text-muted'"
          [attr.aria-pressed]="i18n.lang() === l"
          (click)="i18n.set(l)"
        >{{ l }}</button>
      }
    </div>
  `,
})
export class LangSwitch {
  protected readonly i18n = inject(I18n);
  protected readonly langs = LANGS;
}
