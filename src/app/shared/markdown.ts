import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: true });

/** Renders AI markdown. Angular's [innerHTML] sanitizer strips scripts and
 * event handlers; in-app links (/properties/1) navigate through the router. */
@Component({
  selector: 'app-markdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'prose-ai block', '(click)': 'onClick($event)' },
  template: `<div [innerHTML]="html()"></div>`,
})
export class Markdown {
  private readonly router = inject(Router);
  readonly text = input.required<string>();
  protected readonly html = computed(() => marked.parse(this.text(), { async: false }));

  onClick(event: MouseEvent) {
    const anchor = (event.target as HTMLElement).closest('a');
    const href = anchor?.getAttribute('href');
    if (href?.startsWith('/')) {
      event.preventDefault();
      void this.router.navigateByUrl(href);
    } else if (anchor) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener');
    }
  }
}
