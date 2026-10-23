import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import { eurCompact } from '../../core/format';
import { currentLang, translate } from '../../core/i18n';
import { Property } from '../../core/models';

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Dark Leaflet map with price pins; clicking a pin opens the property. */
@Component({
  selector: 'app-properties-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block overflow-hidden rounded-[1.1rem] border border-[var(--line)]' },
  template: `<div #map class="h-full min-h-[420px] w-full"></div>`,
})
export class PropertiesMap implements AfterViewInit, OnDestroy {
  readonly properties = input.required<Property[]>();
  readonly single = input(false);
  private readonly el = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly router = inject(Router);
  private map?: L.Map;
  private layer = L.layerGroup();

  constructor() {
    // Pins carry localised prices, so they are redrawn on language changes too.
    effect(() => {
      currentLang();
      this.render(this.properties());
    });
  }

  ngAfterViewInit() {
    this.map = L.map(this.el().nativeElement, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: !this.single(),
    }).setView([40.2, -3.7], 6);
    // Standard OSM tiles, darkened with a CSS filter (see .leaflet-tile-pane in styles.css).
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);
    this.layer.addTo(this.map);
    this.render(this.properties());
    // The container may have been sized after init (tabs, flex layouts).
    setTimeout(() => this.map?.invalidateSize(), 150);
  }

  private render(items: Property[]) {
    if (!this.map) return;
    this.layer.clearLayers();
    const points: L.LatLngExpression[] = [];
    for (const p of items) {
      if (p.lat == null || p.lng == null) continue;
      const label = p.operation === 'alquiler' ? `${eurCompact(p.price)}${translate('common.perMonth')}` : eurCompact(p.price);
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: '', html: `<span class="price-pin">${escape(label)}</span>`, iconSize: [0, 0] }),
        title: p.title,
      });
      if (!this.single()) {
        marker.bindTooltip(escape(p.title), { direction: 'top', offset: [0, -12] });
        marker.on('click', () => void this.router.navigate(['/properties', p.id]));
      }
      marker.addTo(this.layer);
      points.push([p.lat, p.lng]);
    }
    if (points.length === 1) this.map.setView(points[0], this.single() ? 15 : 13);
    else if (points.length) this.map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 13 });
  }

  ngOnDestroy() {
    this.map?.remove();
  }
}
