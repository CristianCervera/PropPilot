import { EurPipe, LabelPipe, eur, eurCompact, featureLabel, priceLabel } from './format';

// Intl uses non-breaking spaces; normalise them for readable assertions.
const plain = (s: string) => s.replace(/\s/g, ' ');

describe('format helpers', () => {
  it('formats euros the Spanish way', () => {
    expect(plain(eur(895000))).toBe('895.000 €');
    expect(eur(null)).toBe('—');
    expect(eur(undefined)).toBe('—');
  });

  it('adds /mes to rental prices only', () => {
    expect(plain(priceLabel(1450, 'alquiler'))).toBe('1450 €/mes');
    expect(plain(priceLabel(320000, 'venta'))).toBe('320.000 €');
  });

  it('compacts large amounts for map pins and charts', () => {
    expect(plain(eurCompact(1_650_000))).toBe('1,7 M €');
    expect(plain(eurCompact(895_000))).toBe('895 mil €');
  });

  it('labels features, falling back to a readable key', () => {
    expect(featureLabel('aire_acondicionado')).toBe('Aire acondicionado');
    expect(featureLabel('placas_solares')).toBe('placas solares');
  });
});

describe('EurPipe', () => {
  const pipe = new EurPipe();
  it('uses the operation when given', () => {
    expect(plain(pipe.transform(2100, 'alquiler'))).toBe('2100 €/mes');
    expect(plain(pipe.transform(2100))).toBe('2100 €');
    expect(pipe.transform(null)).toBe('—');
  });
});

describe('LabelPipe', () => {
  const pipe = new LabelPipe();
  it('maps enum values to Spanish labels', () => {
    expect(pipe.transform('atico', 'type')).toBe('Ático');
    expect(pipe.transform('reservado', 'status')).toBe('Reservado');
    expect(pipe.transform('negociando', 'clientStatus')).toBe('Negociando');
    expect(pipe.transform('mascotas', 'feature')).toBe('Admite mascotas');
  });

  it('passes unknown values through and blanks empty ones', () => {
    expect(pipe.transform('nuevo_tipo', 'type')).toBe('nuevo_tipo');
    expect(pipe.transform(null, 'type')).toBe('');
  });
});
