import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api';
import { CLIENT_STATUSES, CLIENT_TYPES, FEATURES, LabelPipe, PROPERTY_TYPES } from '../../core/format';
import { TPipe, translate } from '../../core/i18n';
import { Client, ClientPreferences } from '../../core/models';
import { Toasts } from '../../shared/toast';

type Draft = Partial<Client> & { preferences: ClientPreferences; citiesText: string };

const empty = (): Draft => ({
  name: '',
  email: '',
  phone: '',
  type: 'comprador',
  status: 'nuevo',
  source: '',
  budgetMin: null,
  budgetMax: null,
  notes: '',
  preferences: { types: [], features: [] },
  citiesText: '',
});

@Component({
  selector: 'app-client-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TPipe, LabelPipe],
  template: `
    <form class="grid gap-4 sm:grid-cols-2" (submit)="save($event)">
      <label class="sm:col-span-2"><span class="label">{{ 'board.name' | t }}</span><input class="input mt-1.5" name="name" [(ngModel)]="d.name" required /></label>
      <label><span class="label">{{ 'login.email' | t }}</span><input class="input mt-1.5" type="email" name="email" [(ngModel)]="d.email" /></label>
      <label><span class="label">{{ 'cform.phone' | t }}</span><input class="input mt-1.5" name="phone" [(ngModel)]="d.phone" /></label>
      <label><span class="label">{{ 'props.type' | t }}</span>
        <select class="input mt-1.5" name="type" [(ngModel)]="d.type">
          @for (ct of clientTypes; track ct) { <option [value]="ct">{{ ct | label: 'clientType' }}</option> }
        </select>
      </label>
      <label><span class="label">{{ 'props.status' | t }}</span>
        <select class="input mt-1.5" name="status" [(ngModel)]="d.status">
          @for (cs of clientStatuses; track cs) { <option [value]="cs">{{ cs | label: 'clientStatus' }}</option> }
        </select>
      </label>
      <label><span class="label">{{ 'cform.budgetMin' | t }}</span><input class="input mt-1.5" type="number" name="budgetMin" [(ngModel)]="d.budgetMin" /></label>
      <label><span class="label">{{ 'cform.budgetMax' | t }}</span><input class="input mt-1.5" type="number" name="budgetMax" [(ngModel)]="d.budgetMax" /></label>

      <fieldset class="panel-flat grid gap-3 p-4 sm:col-span-2 sm:grid-cols-2">
        <legend class="label px-1">{{ 'cform.looking' | t }}</legend>
        <label><span class="label">{{ 'props.operation' | t }}</span>
          <select class="input mt-1.5" name="op" [(ngModel)]="d.preferences.operation">
            <option [ngValue]="undefined">{{ 'cform.anyOperation' | t }}</option>
            <option value="venta">{{ 'cform.buy' | t }}</option>
            <option value="alquiler">{{ 'operation.alquiler' | t }}</option>
          </select>
        </label>
        <label><span class="label">{{ 'cform.cities' | t }}</span><input class="input mt-1.5" name="cities" [(ngModel)]="d.citiesText" /></label>
        <label><span class="label">{{ 'cform.minBedrooms' | t }}</span><input class="input mt-1.5" type="number" name="minBedrooms" [(ngModel)]="d.preferences.minBedrooms" /></label>
        <label><span class="label">{{ 'cform.minArea' | t }}</span><input class="input mt-1.5" type="number" name="minArea" [(ngModel)]="d.preferences.minArea" /></label>
        <div class="sm:col-span-2">
          <span class="label">{{ 'cform.types' | t }}</span>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            @for (pt of propertyTypes; track pt) {
              <button type="button" class="chip chip-toggle" [class.on]="d.preferences.types?.includes(pt)" (click)="toggle('types', pt)">{{ pt | label: 'type' }}</button>
            }
          </div>
        </div>
        <div class="sm:col-span-2">
          <span class="label">{{ 'cform.mustHaves' | t }}</span>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            @for (f of features; track f) {
              <button type="button" class="chip chip-toggle" [class.on]="d.preferences.features?.includes(f)" (click)="toggle('features', f)">{{ f | label: 'feature' }}</button>
            }
          </div>
        </div>
      </fieldset>

      <label><span class="label">{{ 'board.source' | t }}</span><input class="input mt-1.5" name="source" [(ngModel)]="d.source" [placeholder]="'cform.sourcePlaceholder' | t" /></label>
      <label class="sm:col-span-2"><span class="label">{{ 'cform.notes' | t }}</span><textarea class="input mt-1.5" rows="3" name="notes" [(ngModel)]="d.notes"></textarea></label>

      <div class="flex justify-end gap-2 sm:col-span-2">
        <button type="submit" class="btn btn-primary" [disabled]="saving() || !d.name">{{ (saving() ? 'common.saving' : 'cform.save') | t }}</button>
      </div>
    </form>
  `,
})
export class ClientForm {
  private readonly api = inject(Api);
  private readonly toasts = inject(Toasts);

  readonly client = input<Client | null>(null);
  readonly saved = output<Client>();

  protected readonly clientTypes = CLIENT_TYPES;
  protected readonly clientStatuses = CLIENT_STATUSES;
  protected readonly propertyTypes = PROPERTY_TYPES;
  protected readonly features = FEATURES;
  protected readonly saving = signal(false);
  protected d: Draft = empty();

  constructor() {
    effect(() => {
      const c = this.client();
      this.d = c
        ? { ...c, preferences: { types: [], features: [], ...structuredClone(c.preferences) }, citiesText: (c.preferences.cities ?? []).join(', ') }
        : empty();
    });
  }

  toggle(key: 'types' | 'features', value: string) {
    const list = (this.d.preferences[key] ?? []) as string[];
    (this.d.preferences[key] as string[]) = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async save(event: Event) {
    event.preventDefault();
    this.saving.set(true);
    const { citiesText, id, createdAt, updatedAt, leadScore, aiSummary, ...rest } = this.d as Draft & Client;
    const prefs = { ...rest.preferences, cities: citiesText.split(',').map((c) => c.trim()).filter(Boolean) };
    for (const key of Object.keys(prefs) as (keyof ClientPreferences)[]) {
      const v = prefs[key];
      if (v == null || (v as unknown) === '' || (Array.isArray(v) && !v.length)) delete prefs[key];
    }
    const body = { ...rest, email: rest.email || null, preferences: prefs };
    try {
      const existing = this.client();
      const saved = existing ? await this.api.updateClient(existing.id, body) : await this.api.createClient(body);
      this.toasts.show(translate(existing ? 'cform.updated' : 'cform.created'));
      this.saved.emit(saved);
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
