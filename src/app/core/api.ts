import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { translate } from './i18n';
import {
  AiSearchResult,
  Briefing,
  Client,
  ClientDetail,
  ClientInsights,
  ConversationSummary,
  ChatTurn,
  DashboardStats,
  Listing,
  MatchInfo,
  Meta,
  Paged,
  Pitch,
  Property,
  PropertyDetail,
  PropertyDraft,
  PropertyFilters,
  Valuation,
  Visit,
  VisitWithRefs,
} from './models';

type Params = Record<string, string | number | boolean | string[] | undefined | null>;

function toParams(obj: Params): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) continue;
    params = params.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  return params;
}

/** Thin promise-based wrapper over the PropPilot REST API. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  private get<T>(url: string, params: Params = {}) {
    return firstValueFrom(this.http.get<T>(`/api${url}`, { params: toParams(params) }));
  }
  private post<T>(url: string, body: unknown = {}) {
    return firstValueFrom(this.http.post<T>(`/api${url}`, body));
  }
  private patch<T>(url: string, body: unknown) {
    return firstValueFrom(this.http.patch<T>(`/api${url}`, body));
  }
  private delete(url: string) {
    return firstValueFrom(this.http.delete<void>(`/api${url}`));
  }

  meta = () => this.get<Meta>('/meta');
  health = () => this.get<{ ok: boolean; ai: boolean; model: string }>('/health');
  dashboard = () => this.get<DashboardStats>('/dashboard');

  // Properties
  properties = (f: PropertyFilters & { limit?: number }) =>
    this.get<Paged<Property>>('/properties', f as Params);
  property = (id: number) => this.get<PropertyDetail>(`/properties/${id}`);
  locations = () => this.get<{ city: string; districts: string[] }[]>('/properties/locations');
  createProperty = (body: Partial<Property>) => this.post<Property>('/properties', body);
  updateProperty = (id: number, body: Partial<Property>) =>
    this.patch<Property>(`/properties/${id}`, body);
  deleteProperty = (id: number) => this.delete(`/properties/${id}`);
  propertyMatches = (id: number) =>
    this.get<(MatchInfo & { client: Client })[]>(`/properties/${id}/matches`);
  uploadImages(id: number, files: File[]) {
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    return this.post<Property>(`/properties/${id}/images`, form);
  }

  // Clients
  clients = (f: { q?: string; statuses?: string[]; type?: string } = {}) =>
    this.get<Client[]>('/clients', f);
  client = (id: number) => this.get<ClientDetail>(`/clients/${id}`);
  createClient = (body: Partial<Client>) => this.post<Client>('/clients', body);
  updateClient = (id: number, body: Partial<Client>) => this.patch<Client>(`/clients/${id}`, body);
  deleteClient = (id: number) => this.delete(`/clients/${id}`);
  clientMatches = (id: number) =>
    this.get<(MatchInfo & { property: Property })[]>(`/clients/${id}/matches`);

  // Visits
  visits = (f: { from?: string; to?: string; status?: string } = {}) =>
    this.get<VisitWithRefs[]>('/visits', f);
  createVisit = (body: Partial<Visit>) => this.post<Visit>('/visits', body);
  updateVisit = (id: number, body: Partial<Visit>) => this.patch<Visit>(`/visits/${id}`, body);
  deleteVisit = (id: number) => this.delete(`/visits/${id}`);

  // AI
  aiSearch = (query: string) => this.post<AiSearchResult>('/ai/search', { query });
  aiExtractProperty = (text: string) => this.post<PropertyDraft>('/ai/extract-property', { text });
  aiListing = (id: number, opts: { tone: string; language: string; usePhotos: boolean }) =>
    this.post<Listing>(`/ai/properties/${id}/listing`, opts);
  aiValuation = (id: number) => this.post<Valuation>(`/ai/properties/${id}/valuation`);
  aiInsights = (id: number) => this.post<ClientInsights>(`/ai/clients/${id}/insights`);
  aiPitch = (propertyId: number, clientId: number, channel: 'whatsapp' | 'email') =>
    this.post<Pitch>('/ai/pitch', { propertyId, clientId, channel });
  aiBriefing = () => this.post<Briefing>('/ai/briefing');

  conversations = () => this.get<ConversationSummary[]>('/ai/copilot/conversations');
  conversation = (id: number) =>
    this.get<{ id: number; title: string; turns: ChatTurn[] }>(`/ai/copilot/conversations/${id}`);
  deleteConversation = (id: number) => this.delete(`/ai/copilot/conversations/${id}`);
}

/** Extracts a human message from an HttpErrorResponse or any thrown value. */
export function errorMessage(err: unknown): string {
  const e = err as { error?: { message?: unknown }; message?: string; status?: number };
  if (e?.status === 0) return translate('common.offline');
  const msg = e?.error?.message;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) return msg.join(', ');
  return e?.message ?? translate('common.unexpected');
}
