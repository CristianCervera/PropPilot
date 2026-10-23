import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { FEATURES, LabelPipe, PROPERTY_STATUSES, PROPERTY_TYPES } from '../../core/format';
import { TKey, TPipe, translate } from '../../core/i18n';
import { Property, PropertyDraft } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Toasts } from '../../shared/toast';
import { AiThinking, Photo } from '../../shared/ui';

@Component({
  selector: 'app-property-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, AiThinking, Photo, TPipe, LabelPipe],
  template: `
    <div class="mx-auto max-w-5xl space-y-6">
      <div class="flex items-center gap-3">
        <a [routerLink]="id() ? ['/properties', id()] : '/properties'" class="btn btn-ghost btn-icon" [attr.aria-label]="'common.back' | t"><app-icon name="chevron-left" /></a>
        <h1 class="h-display text-2xl font-semibold">{{ (id() ? 'title.editProperty' : 'title.newProperty') | t }}</h1>
      </div>

      <!-- AI autofill -->
      <section class="ai-surface p-5">
        <div class="flex items-start gap-3">
          <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-[image:var(--grad-ai)] text-white"><app-icon name="wand" [size]="18" /></span>
          <div class="flex-1">
            <h2 class="h-display font-semibold">{{ 'form.autofill' | t }}</h2>
            <p class="text-sm text-muted">{{ 'form.autofillHint' | t }}</p>
          </div>
        </div>
        <textarea
          class="input mt-4 min-h-28"
          [placeholder]="'form.autofillPlaceholder' | t"
          [value]="aiText()"
          (input)="aiText.set($any($event.target).value)"
          [attr.aria-label]="'form.autofillAria' | t"
        ></textarea>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
          @if (aiLoading()) {
            <app-ai-thinking class="w-full" [label]="'form.extracting' | t" />
          } @else {
            <p class="text-sm" [class]="aiMissing().length ? 'text-warn' : 'text-faint'">
              @if (aiMissing().length) {
                {{ 'form.missing' | t: { fields: aiMissing().join(', ') } }}
              } @else if (aiError()) {
                <span class="text-bad">{{ aiError() }}</span>
              } @else {
                {{ 'form.reviewHint' | t }}
              }
            </p>
            <button class="btn btn-primary" (click)="autofill()" [disabled]="aiText().trim().length < 10">
              <app-icon name="sparkles" [size]="16" /> {{ 'form.fill' | t }}
            </button>
          }
        </div>
      </section>

      <form [formGroup]="form" (ngSubmit)="save()" class="space-y-6">
        <section class="panel grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <h2 class="h-display font-semibold sm:col-span-2">{{ 'form.main' | t }}</h2>
          <label class="sm:col-span-2">
            <span class="label">{{ 'detail.title' | t }}</span>
            <input class="input mt-1.5" formControlName="title" [class.ai-filled]="filled('title')" />
          </label>
          <label>
            <span class="label">{{ 'props.operation' | t }}</span>
            <select class="input mt-1.5" formControlName="operation">
              <option value="venta">{{ 'operation.venta' | t }}</option>
              <option value="alquiler">{{ 'operation.alquiler' | t }}</option>
            </select>
          </label>
          <label>
            <span class="label">{{ 'props.type' | t }}</span>
            <select class="input mt-1.5" formControlName="type">
              @for (pt of types; track pt) {
                <option [value]="pt">{{ pt | label: 'type' }}</option>
              }
            </select>
          </label>
          <label>
            <span class="label">{{ 'form.price' | t }} (€{{ form.value.operation === 'alquiler' ? ('common.perMonth' | t) : '' }})</span>
            <input class="input mt-1.5" type="number" formControlName="price" min="0" />
          </label>
          <label>
            <span class="label">{{ 'props.status' | t }}</span>
            <select class="input mt-1.5" formControlName="status">
              @for (st of statuses; track st) {
                <option [value]="st">{{ st | label: 'status' }}</option>
              }
            </select>
          </label>
          <label class="sm:col-span-2">
            <span class="label">{{ 'detail.description' | t }}</span>
            <textarea class="input mt-1.5 min-h-32" formControlName="description"></textarea>
          </label>
        </section>

        <section class="panel grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 sm:p-6 lg:grid-cols-6">
          <h2 class="h-display col-span-full font-semibold">{{ 'form.characteristics' | t }}</h2>
          @for (f of numberFields; track f.key) {
            <label>
              <span class="label">{{ f.label | t }}</span>
              <input class="input mt-1.5" type="number" [formControlName]="f.key" />
            </label>
          }
          <label>
            <span class="label">{{ 'detail.energy' | t }}</span>
            <select class="input mt-1.5" formControlName="energyRating">
              <option [ngValue]="null">—</option>
              @for (r of ratings; track r) {
                <option [value]="r">{{ r }}</option>
              }
            </select>
          </label>
          <div class="col-span-full">
            <span class="label">{{ 'form.extras' | t }}</span>
            <div class="mt-2 flex flex-wrap gap-2">
              @for (f of features; track f) {
                <button type="button" class="chip chip-toggle" [class.on]="hasFeature(f)" (click)="toggleFeature(f)">{{ f | label: 'feature' }}</button>
              }
            </div>
          </div>
        </section>

        <section class="panel grid gap-4 p-5 sm:grid-cols-4 sm:p-6">
          <h2 class="h-display font-semibold sm:col-span-4">{{ 'form.location' | t }}</h2>
          <label class="sm:col-span-2">
            <span class="label">{{ 'form.address' | t }}</span>
            <input class="input mt-1.5" formControlName="address" />
          </label>
          <label>
            <span class="label">{{ 'props.city' | t }}</span>
            <input class="input mt-1.5" formControlName="city" />
          </label>
          <label>
            <span class="label">{{ 'form.district' | t }}</span>
            <input class="input mt-1.5" formControlName="district" />
          </label>
          <label>
            <span class="label">{{ 'form.postalCode' | t }}</span>
            <input class="input mt-1.5" formControlName="postalCode" />
          </label>
          <label>
            <span class="label">{{ 'form.lat' | t }}</span>
            <input class="input mt-1.5" type="number" step="any" formControlName="lat" />
          </label>
          <label>
            <span class="label">{{ 'form.lng' | t }}</span>
            <input class="input mt-1.5" type="number" step="any" formControlName="lng" />
          </label>
          <div class="flex items-end">
            <button type="button" class="btn btn-ghost w-full" (click)="geocode()" [disabled]="geocoding()">
              <app-icon name="pin" [size]="15" /> {{ (geocoding() ? 'form.locating' : 'form.locate') | t }}
            </button>
          </div>
        </section>

        <section class="panel p-5 sm:p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="h-display font-semibold">{{ 'form.photos' | t }}</h2>
            <label class="btn btn-ghost cursor-pointer">
              <app-icon name="upload" [size]="15" /> {{ 'form.addPhotos' | t }}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple class="hidden" (change)="pickFiles($event)" />
            </label>
          </div>
          <div class="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
            @for (img of images(); track img; let i = $index) {
              <div class="group relative aspect-square overflow-hidden rounded-xl">
                <app-photo class="h-full w-full" [src]="img" />
                <button type="button" class="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/60 opacity-0 transition group-hover:opacity-100" (click)="removeImage(i)" [attr.aria-label]="'form.removePhoto' | t">
                  <app-icon name="x" [size]="14" />
                </button>
                @if (i === 0) {
                  <span class="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 text-[10px]">{{ 'form.cover' | t }}</span>
                }
              </div>
            }
            @for (f of pending(); track f.name) {
              <div class="relative aspect-square overflow-hidden rounded-xl border border-dashed border-[var(--line-strong)]">
                <img [src]="f.preview" alt="" class="h-full w-full object-cover opacity-70" />
                <span class="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 text-[10px]">{{ 'form.pending' | t }}</span>
              </div>
            }
          </div>
          <label class="mt-4 block">
            <span class="label">{{ 'form.imageUrls' | t }}</span>
            <textarea class="input mt-1.5" rows="2" #urls></textarea>
          </label>
          <button type="button" class="btn btn-ghost btn-sm mt-2" (click)="addUrls(urls.value); urls.value = ''">{{ 'form.addUrls' | t }}</button>
        </section>

        <div class="sticky bottom-4 z-10 flex justify-end gap-2">
          <a [routerLink]="id() ? ['/properties', id()] : '/properties'" class="btn btn-ghost bg-ink-900">{{ 'common.cancel' | t }}</a>
          <button type="submit" class="btn btn-primary" [disabled]="form.invalid || saving()">
            <app-icon name="check" [size]="16" /> {{ (saving() ? 'common.saving' : 'form.save') | t }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: `
    .ai-filled {
      border-color: rgb(192 79 216 / 0.6);
    }
  `,
})
export class PropertyForm implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly toasts = inject(Toasts);
  private readonly fb = inject(FormBuilder);

  readonly id = input<string>();

  protected readonly types = PROPERTY_TYPES;
  protected readonly statuses = PROPERTY_STATUSES;
  protected readonly features = FEATURES;
  protected readonly ratings = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  protected readonly numberFields: { key: 'area' | 'bedrooms' | 'bathrooms' | 'floor' | 'yearBuilt'; label: TKey }[] = [
    { key: 'area', label: 'form.areaM2' },
    { key: 'bedrooms', label: 'detail.bedrooms' },
    { key: 'bathrooms', label: 'detail.bathrooms' },
    { key: 'floor', label: 'detail.floor' },
    { key: 'yearBuilt', label: 'detail.year' },
  ];

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: [null as string | null],
    operation: ['venta' as Property['operation'], Validators.required],
    type: ['piso' as Property['type'], Validators.required],
    status: ['borrador' as Property['status']],
    price: [null as number | null, [Validators.required, Validators.min(1)]],
    area: [null as number | null, [Validators.required, Validators.min(1)]],
    bedrooms: [0 as number | null],
    bathrooms: [0 as number | null],
    floor: [null as number | null],
    yearBuilt: [null as number | null],
    energyRating: [null as string | null],
    features: [[] as string[]],
    address: [null as string | null],
    city: ['', Validators.required],
    district: [null as string | null],
    postalCode: [null as string | null],
    lat: [null as number | null],
    lng: [null as number | null],
  });

  protected readonly images = signal<string[]>([]);
  protected readonly pending = signal<{ file: File; name: string; preview: string }[]>([]);
  protected readonly saving = signal(false);
  protected readonly geocoding = signal(false);

  protected readonly aiText = signal('');
  protected readonly aiLoading = signal(false);
  protected readonly aiError = signal<string | null>(null);
  protected readonly aiMissing = signal<string[]>([]);
  private readonly aiFields = signal<Set<string>>(new Set());

  async ngOnInit() {
    const id = this.id();
    if (!id) return;
    const p = await this.api.property(Number(id));
    this.form.patchValue(p);
    this.images.set(p.images);
  }

  filled = (key: string) => this.aiFields().has(key);
  hasFeature = (f: string) => (this.form.value.features ?? []).includes(f);

  toggleFeature(f: string) {
    const current = this.form.value.features ?? [];
    this.form.patchValue({ features: current.includes(f) ? current.filter((x) => x !== f) : [...current, f] });
  }

  async autofill() {
    this.aiLoading.set(true);
    this.aiError.set(null);
    try {
      const draft: PropertyDraft = await this.api.aiExtractProperty(this.aiText());
      const { missing, ...data } = draft;
      const patch = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)),
      );
      this.form.patchValue(patch);
      this.aiFields.set(new Set(Object.keys(patch)));
      this.aiMissing.set(missing);
      this.toasts.show(translate('form.filled', { n: Object.keys(patch).length }), 'ai');
    } catch (err) {
      this.aiError.set(errorMessage(err));
    } finally {
      this.aiLoading.set(false);
    }
  }

  async geocode() {
    const v = this.form.value;
    const q = [v.address, v.postalCode, v.city, 'España'].filter(Boolean).join(', ');
    if (!v.city) {
      this.toasts.error(translate('form.cityRequired'));
      return;
    }
    this.geocoding.set(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const [hit] = (await res.json()) as { lat: string; lon: string }[];
      if (!hit) throw new Error(translate('form.addressNotFound'));
      this.form.patchValue({ lat: Number(hit.lat), lng: Number(hit.lon) });
      this.toasts.show(translate('form.located'));
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.geocoding.set(false);
    }
  }

  pickFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.pending.update((p) => [...p, ...files.map((file) => ({ file, name: file.name, preview: URL.createObjectURL(file) }))]);
    input.value = '';
  }

  addUrls(text: string) {
    const urls = text
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => /^https:\/\//.test(u));
    this.images.update((imgs) => [...imgs, ...urls]);
  }

  removeImage(index: number) {
    this.images.update((imgs) => imgs.filter((_, i) => i !== index));
  }

  async save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const body = { ...this.form.getRawValue(), images: this.images() } as Partial<Property>;
      const id = this.id();
      let saved = id ? await this.api.updateProperty(Number(id), body) : await this.api.createProperty(body);
      const files = this.pending().map((p) => p.file);
      if (files.length) saved = await this.api.uploadImages(saved.id, files);
      this.toasts.show(translate(id ? 'form.updated' : 'form.created'));
      void this.router.navigate(['/properties', saved.id]);
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }
}
