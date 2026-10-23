export type PropertyType =
  | 'piso'
  | 'atico'
  | 'duplex'
  | 'casa'
  | 'chalet'
  | 'estudio'
  | 'local'
  | 'oficina'
  | 'terreno';
export type Operation = 'venta' | 'alquiler';
export type PropertyStatus = 'borrador' | 'disponible' | 'reservado' | 'vendido' | 'alquilado';
export type ClientType = 'comprador' | 'inquilino' | 'vendedor' | 'propietario' | 'inversor';
export type ClientStatus =
  | 'nuevo'
  | 'contactado'
  | 'cualificado'
  | 'visitando'
  | 'negociando'
  | 'cerrado'
  | 'perdido';
export type VisitStatus = 'programada' | 'realizada' | 'cancelada';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'agent';
}

export interface Valuation {
  estimatedPrice: number;
  rangeLow: number;
  rangeHigh: number;
  pricePerM2: number;
  confidence: 'baja' | 'media' | 'alta';
  verdict: 'por_debajo' | 'en_mercado' | 'por_encima';
  summary: string;
  factors: { factor: string; impact: 'positivo' | 'negativo' | 'neutro'; detail: string }[];
  recommendation: string;
  generatedAt: string;
}

export interface Property {
  id: number;
  reference: string;
  title: string;
  description: string | null;
  type: PropertyType;
  operation: Operation;
  status: PropertyStatus;
  price: number;
  area: number;
  bedrooms: number;
  bathrooms: number;
  floor: number | null;
  yearBuilt: number | null;
  energyRating: string | null;
  features: string[];
  images: string[];
  address: string | null;
  city: string;
  district: string | null;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  highlighted: boolean;
  aiValuation: Valuation | null;
  ownerId: number | null;
  agentId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyDetail extends Property {
  owner: Client | null;
  agent: { id: number; name: string; email: string; phone: string | null } | null;
  visits: (Visit & { client: { id: number; name: string } })[];
}

export interface ClientPreferences {
  operation?: Operation;
  types?: PropertyType[];
  cities?: string[];
  districts?: string[];
  minBedrooms?: number;
  minArea?: number;
  features?: string[];
}

export interface Client {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  type: ClientType;
  status: ClientStatus;
  source: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  preferences: ClientPreferences;
  notes: string | null;
  leadScore: number | null;
  aiSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientDetail extends Client {
  visits: (Visit & {
    property: { id: number; title: string; reference: string; images: string[] };
  })[];
  ownedProperties: { id: number; title: string; reference: string; status: PropertyStatus }[];
}

export interface Visit {
  id: number;
  propertyId: number;
  clientId: number;
  scheduledAt: string;
  durationMin: number;
  status: VisitStatus;
  notes: string | null;
  feedback: string | null;
}

export interface VisitWithRefs extends Visit {
  property: {
    id: number;
    title: string;
    reference?: string;
    address?: string | null;
    city: string;
    images: string[];
  };
  client: { id: number; name: string; phone?: string | null };
}

export interface MatchInfo {
  score: number;
  reasons: string[];
  mismatches: string[];
}

export interface PropertyFilters {
  q?: string;
  operation?: Operation;
  types?: PropertyType[];
  statuses?: PropertyStatus[];
  cities?: string[];
  districts?: string[];
  priceMin?: number;
  priceMax?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minArea?: number;
  maxArea?: number;
  features?: string[];
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'area_desc';
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface Meta {
  propertyTypes: PropertyType[];
  operations: Operation[];
  propertyStatuses: PropertyStatus[];
  propertyFeatures: string[];
  clientTypes: ClientType[];
  clientStatuses: ClientStatus[];
  visitStatuses: VisitStatus[];
}

export interface DashboardStats {
  kpis: {
    activeListings: number;
    portfolioSaleValue: number;
    monthlyRentValue: number;
    newClients30d: number;
    visitsDone30d: number;
    upcomingVisits: number;
  };
  propertiesByStatus: { status: PropertyStatus; total: number }[];
  propertiesByCity: { city: string; total: number; avgPriceM2: number }[];
  propertiesByType: { type: PropertyType; total: number }[];
  clientPipeline: { status: ClientStatus; total: number }[];
  upcomingVisits: VisitWithRefs[];
  hotLeads: Client[];
  staleListings: { id: number; title: string; createdAt: string; status: PropertyStatus }[];
}

// ---- AI payloads ----

export interface AiSearchResult extends Paged<Property> {
  interpretation: string;
  filters: PropertyFilters;
  relaxed: boolean;
}

export interface PropertyDraft {
  title: string;
  description: string | null;
  type: PropertyType | null;
  operation: Operation | null;
  price: number | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floor: number | null;
  yearBuilt: number | null;
  energyRating: string | null;
  features: string[];
  address: string | null;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  missing: string[];
}

export interface Listing {
  title: string;
  description: string;
  highlights: string[];
  socialPost: string;
  seoKeywords: string[];
  photoInsights: string[];
}

export interface ClientInsights {
  leadScore: number;
  temperature: 'frio' | 'templado' | 'caliente';
  summary: string;
  nextBestAction: string;
  followUpMessage: string;
  risks: string[];
  recommendations: { propertyId: number; reason: string }[];
}

export interface Briefing {
  headline: string;
  summary: string;
  priorities: {
    title: string;
    detail: string;
    kind: 'visita' | 'lead' | 'inmueble' | 'mercado';
    propertyId: number | null;
    clientId: number | null;
  }[];
}

export interface Pitch {
  subject: string | null;
  message: string;
}

// ---- Copilot ----

export interface PropertyCard {
  id: number;
  reference: string;
  title: string;
  price: number;
  operation: Operation;
  status: PropertyStatus;
  city: string;
  district: string | null;
  bedrooms: number;
  area: number;
  image: string | null;
  score?: number;
}

export interface ClientCard {
  id: number;
  name: string;
  type: ClientType;
  status: ClientStatus;
  budgetMax: number | null;
  leadScore: number | null;
  score?: number;
}

export type ToolUi =
  | { kind: 'properties'; items: PropertyCard[] }
  | { kind: 'clients'; items: ClientCard[] }
  | { kind: 'visit'; visit: { id: number; scheduledAt: string; propertyId: number; clientId: number } }
  | { kind: 'stats'; kpis: Record<string, number> };

export type ChatPart =
  | { type: 'text'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool'; id: string; name: string; ok?: boolean; pending?: boolean; ui?: ToolUi };

export interface ChatTurn {
  role: 'user' | 'assistant';
  parts: ChatPart[];
}

export interface ConversationSummary {
  id: number;
  title: string;
  updatedAt: string;
}

export type CopilotEvent =
  | { type: 'conversation'; id: number; title: string }
  | { type: 'thinking'; delta: string }
  | { type: 'text'; delta: string }
  | { type: 'tool_start'; id: string; name: string }
  | { type: 'tool_end'; id: string; name: string; ok: boolean; ui?: ToolUi }
  | { type: 'error'; message: string }
  | { type: 'done' };
