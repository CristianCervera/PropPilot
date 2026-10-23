import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Markdown } from './markdown';
import { Modal, PropertyCardView, StatusBadge } from './ui';

describe('StatusBadge', () => {
  it('shows the Spanish label for properties and clients', async () => {
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('value', 'reservado');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe('Reservado');

    fixture.componentRef.setInput('value', 'negociando');
    fixture.componentRef.setInput('kind', 'client');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe('Negociando');
  });
});

describe('PropertyCardView', () => {
  const base = {
    id: 5,
    title: 'Loft industrial en Malasaña',
    price: 1450,
    operation: 'alquiler' as const,
    status: 'disponible' as const,
    city: 'Madrid',
    district: 'Malasaña',
    bedrooms: 1,
    area: 70,
    reference: 'PP-1003',
  };

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('renders price, location and a link to the detail', async () => {
    const fixture = TestBed.createComponent(PropertyCardView);
    fixture.componentRef.setInput('property', base);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('a')!.getAttribute('href')).toBe('/properties/5');
    expect(el.textContent!.replace(/\s+/g, ' ')).toContain('1450 €/mes');
    expect(el.textContent).toContain('Malasaña, Madrid');
    expect(el.textContent).not.toContain('encaje');
  });

  it('shows the match score when present', async () => {
    const fixture = TestBed.createComponent(PropertyCardView);
    fixture.componentRef.setInput('property', { ...base, score: 87 });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('87% encaje');
  });
});

@Component({
  imports: [Modal],
  template: `<app-modal [(open)]="open" title="Confirmar" (closed)="closed = closed + 1"><p>Contenido</p></app-modal>`,
})
class ModalHost {
  open = signal(true);
  closed = 0;
}

describe('Modal', () => {
  it('closes with Escape, the close button or the backdrop', async () => {
    const fixture = TestBed.createComponent(ModalHost);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role=dialog]')!.getAttribute('aria-label')).toBe('Confirmar');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(el.querySelector('[role=dialog]')).toBeNull();
    expect(fixture.componentInstance.closed).toBe(1);

    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    (el.querySelector('[role=dialog]') as HTMLElement).click(); // clicks inside do not close
    await fixture.whenStable();
    expect(el.querySelector('[role=dialog]')).not.toBeNull();
    (el.querySelector('button[aria-label=Cerrar]') as HTMLElement).click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
  });
});

describe('Markdown', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  async function render(text: string) {
    const fixture = TestBed.createComponent(Markdown);
    fixture.componentRef.setInput('text', text);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders AI markdown and strips scripts and handlers', async () => {
    const el = await render('**Hola** <img src=x onerror="alert(1)"><script>alert(2)</script>');
    expect(el.querySelector('strong')!.textContent).toBe('Hola');
    expect(el.innerHTML).not.toContain('onerror');
    expect(el.querySelector('script')).toBeNull();
  });

  it('routes in-app links and opens external ones in a new tab', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const el = await render('[Ático](/properties/1) y [web](https://example.com)');
    const [internal, external] = Array.from(el.querySelectorAll('a'));

    internal.click();
    expect(navigate).toHaveBeenCalledWith('/properties/1');

    external.addEventListener('click', (e) => e.preventDefault()); // jsdom cannot navigate
    external.click();
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toBe('noopener');
  });
});
