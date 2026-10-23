import { Pipe, PipeTransform } from '@angular/core';
import { currentLocale, translate, translateOr } from './i18n';
import { ClientStatus, ClientType, Operation, PropertyStatus, PropertyType, VisitStatus } from './models';

// Formatters are cached per locale; reading currentLocale() keeps callers reactive.
const cache = new Map<string, Intl.NumberFormat>();
function fmt(kind: 'eur' | 'compact' | 'num') {
  const locale = currentLocale();
  const key = `${kind}:${locale}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(
      locale,
      kind === 'eur'
        ? { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }
        : kind === 'compact'
          ? { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }
          : { maximumFractionDigits: 0 },
    );
    cache.set(key, f);
  }
  return f;
}

export const eur = (n: number | null | undefined) => (n == null ? '—' : fmt('eur').format(n));
/** `1,7 M €` / `€1.7m`: the currency symbol goes where each language expects it. */
export const eurCompact = (n: number) => fmt('compact').format(n);
export const num = (n: number) => fmt('num').format(n);

export const priceLabel = (price: number, operation: Operation) =>
  operation === 'alquiler' ? `${eur(price)}${translate('common.perMonth')}` : eur(price);

export const PROPERTY_TYPES: PropertyType[] = ['piso', 'atico', 'duplex', 'casa', 'chalet', 'estudio', 'local', 'oficina', 'terreno'];
export const PROPERTY_STATUSES: PropertyStatus[] = ['borrador', 'disponible', 'reservado', 'vendido', 'alquilado'];
export const CLIENT_TYPES: ClientType[] = ['comprador', 'inquilino', 'vendedor', 'propietario', 'inversor'];
export const CLIENT_STATUSES: ClientStatus[] = ['nuevo', 'contactado', 'cualificado', 'visitando', 'negociando', 'cerrado', 'perdido'];
export const VISIT_STATUSES: VisitStatus[] = ['programada', 'realizada', 'cancelada'];
export const FEATURES = [
  'ascensor',
  'parking',
  'piscina',
  'terraza',
  'jardin',
  'trastero',
  'aire_acondicionado',
  'calefaccion',
  'amueblado',
  'exterior',
  'vistas',
  'portero',
  'gimnasio',
  'domotica',
  'mascotas',
];

export const PROPERTY_STATUS_COLOR: Record<PropertyStatus, string> = {
  borrador: '#8b84ad',
  disponible: '#34d399',
  reservado: '#fbbf24',
  vendido: '#e64fb0',
  alquilado: '#60a5fa',
};

export const CLIENT_STATUS_COLOR: Record<ClientStatus, string> = {
  nuevo: '#60a5fa',
  contactado: '#818cf8',
  cualificado: '#a78bfa',
  visitando: '#c084fc',
  negociando: '#f472b6',
  cerrado: '#34d399',
  perdido: '#6f6895',
};

export type LabelKind = 'type' | 'status' | 'clientType' | 'clientStatus' | 'visitStatus' | 'feature';

/** Display label for an enum value in the current language. */
export function label(kind: LabelKind, value: string | null | undefined): string {
  if (!value) return '';
  return translateOr(`${kind}.${value}`, kind === 'feature' ? value.replaceAll('_', ' ') : value);
}

export const featureLabel = (f: string) => label('feature', f);

@Pipe({ name: 'eur', pure: false })
export class EurPipe implements PipeTransform {
  transform(value: number | null | undefined, operation?: Operation): string {
    if (value == null) return '—';
    return operation ? priceLabel(value, operation) : eur(value);
  }
}

@Pipe({ name: 'label', pure: false })
export class LabelPipe implements PipeTransform {
  transform(value: string | null | undefined, kind: LabelKind): string {
    return label(kind, value);
  }
}
