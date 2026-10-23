import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Api, errorMessage } from './api';

describe('Api', () => {
  let api: Api;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(Api);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('serialises filters as query params, skipping empty values', async () => {
    const pending = api.properties({
      operation: 'venta',
      types: ['piso', 'atico'],
      features: [],
      cities: undefined,
      q: '',
      priceMax: 500000,
      limit: 12,
    });
    const req = backend.expectOne((r) => r.url === '/api/properties');
    expect(req.request.params.keys().sort()).toEqual(['limit', 'operation', 'priceMax', 'types']);
    expect(req.request.params.get('types')).toBe('piso,atico');
    req.flush({ items: [], total: 0 });
    expect(await pending).toEqual({ items: [], total: 0 });
  });

  it('sends PATCH bodies with only the changed fields', () => {
    void api.updateClient(4, { status: 'negociando' });
    const req = backend.expectOne('/api/clients/4');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'negociando' });
    req.flush({});
  });
});

describe('errorMessage', () => {
  const http = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

  it('prefers the API message', () => {
    expect(errorMessage(http(503, { message: 'La IA no está configurada' }))).toBe('La IA no está configurada');
    expect(errorMessage(http(400, { message: ['a', 'b'] }))).toBe('a, b');
  });

  it('explains a lost connection', () => {
    expect(errorMessage(http(0, null))).toBe('No hay conexión con el servidor.');
  });

  it('falls back to the error message or a generic text', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage(undefined)).toBe('Ha ocurrido un error inesperado.');
  });
});
