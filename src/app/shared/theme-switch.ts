import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TPipe } from '../core/i18n';
import { ThemeService } from '../core/theme';
import { Icon } from './icon';

/** Sun/moon button that flips between light and dark mode. */
@Component({
  selector: 'app-theme-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TPipe],
  template: `
    @let label = (theme.theme() === 'dark' ? 'theme.toLight' : 'theme.toDark') | t;
    <button
      type="button"
      class="grid size-[26px] place-items-center rounded-lg border border-[var(--line)] bg-tint/[0.02] text-faint transition hover:text-fg"
      [title]="label"
      [attr.aria-label]="label"
      (click)="theme.toggle()"
    >
      <app-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="14" />
    </button>
  `,
})
export class ThemeSwitch {
  protected readonly theme = inject(ThemeService);
}
