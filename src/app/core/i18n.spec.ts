import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth';
import { eur, eurCompact, label } from './format';
import { DatePipeI18n, I18n, I18nTitleStrategy, TPipe, formatDateLocal, translate } from './i18n';
import { en } from './i18n/en';
import { es } from './i18n/es';

const plain = (s: string) => s.replace(/\s/g, ' ');

describe('i18n', () => {
  let i18n: I18n;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    i18n = TestBed.inject(I18n);
    i18n.set('es');
  });
  afterEach(() => i18n.set('es'));

  it('has every key translated in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    for (const [key, value] of Object.entries(en)) expect(value, key).not.toBe('');
  });

  it('keeps placeholders consistent between languages', () => {
    const vars = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])].sort();
    for (const key of Object.keys(es) as (keyof typeof es)[]) expect(vars(en[key]), key).toEqual(vars(es[key]));
  });

  it('switches language, fills placeholders and picks plural forms', () => {
    expect(translate('title.properties')).toBe('Inmuebles');
    i18n.set('en');
    expect(translate('title.properties')).toBe('Properties');
    expect(translate('detail.owner', { name: 'Ana' })).toBe('Owner: Ana');
    expect(translate('props.results', { n: 1 })).toBe('1 result');
    expect(translate('props.results', { n: 12 })).toBe('12 results');
  });

  it('remembers the choice and updates <html lang>', () => {
    i18n.set('en');
    TestBed.tick();
    expect(localStorage.getItem('proppilot.lang')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('localises enum labels, money and dates', () => {
    i18n.set('en');
    expect(label('type', 'atico')).toBe('Penthouse');
    expect(label('clientStatus', 'negociando')).toBe('Negotiating');
    expect(label('feature', 'placas_solares')).toBe('placas solares');
    expect(plain(eur(895000))).toBe('€895,000');
    expect(eurCompact(1_650_000)).toBe('€1.7m');
    expect(formatDateLocal('2026-03-05T10:00:00', "EEEE d 'de' MMMM")).toBe('Thursday 5 March');

    i18n.set('es');
    expect(plain(eur(895000))).toBe('895.000 €');
    expect(formatDateLocal('2026-03-05T10:00:00', "EEEE d 'de' MMMM")).toBe('jueves 5 de marzo');
  });

  it('re-renders OnPush templates when the language changes', async () => {
    @Component({
      imports: [TPipe, DatePipeI18n],
      template: `<h1>{{ 'title.agenda' | t }}</h1><p>{{ day | d: 'EEEE' }}</p>`,
    })
    class Host {
      day = new Date('2026-03-05T10:00:00');
    }
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toBe('Agendajueves');
    i18n.set('en');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toBe('CalendarThursday');
  });

  it('sends the UI language to the API', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    TestBed.inject(I18n).set('en');
    void firstValueFrom(TestBed.inject(HttpClient).get('/api/health'));
    const req = TestBed.inject(HttpTestingController).expectOne('/api/health');
    expect(req.request.headers.get('X-Lang')).toBe('en');
    req.flush({});
  });

  it('translates page titles and re-applies them on language changes', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'agenda', title: 'title.agenda', component: class {} }]),
        { provide: TitleStrategy, useClass: I18nTitleStrategy },
      ],
    });
    await TestBed.inject(Router).navigateByUrl('/agenda');
    const title = TestBed.inject(Title);
    expect(title.getTitle()).toBe('Agenda · PropPilot');
    TestBed.inject(I18n).set('en');
    TestBed.tick();
    expect(title.getTitle()).toBe('Calendar · PropPilot');
  });
});
