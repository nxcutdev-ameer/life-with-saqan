export type OffplanUnitPayload = {
  id: number;
  unit_number?: string | null;
  type_of_sale?: string | null;
  type?: string | null;
  layout?: string | null;
  price?: string | number | null;
  square?: string | number | null;
  floor?: string | number | null;
  bedrooms?: string | number | null;
  bathrooms?: string | number | null;
  property_reference_id?: string | null;
};

export type OffplanPaymentPhasePayload = {
  id: string;
  label?: string | null;
  value?: number | null;
};

export type OffplanPaymentPlanPayload = {
  id: number;
  title?: string | null;
  phases?: OffplanPaymentPhasePayload[] | null;
};

export type OffplanAttachmentPayload = {
  id: number;
  type?: string | null;
  upload?: {
    url?: string | null;
    name?: string | null;
    extension?: string | null;
  } | null;
  url?: string | null;
};

export type OffplanPropertyDetailsPayload = {
  id: number;
  reference_id: string;
  title: string;
  description?: string | null;
  type: 'offplan' | string;
  handover_at?: string | null;
  handover_at_date?: string | null;
  district?: { id: number; name: string } | null;
  emirate?: { id: number; name: string } | null;
  price?: { from?: string | number | null; to?: string | number | null } | null;
  units?: OffplanUnitPayload[] | null;
  amenities?: Array<{ id?: number; name?: string | null }> | null;
  developer?: { id?: number; name?: string | null; site?: string | null } | null;
  media?: Array<{ id?: number; type?: string; url?: string | null; upload?: { url?: string | null } | null }>;
  payment_plan?: OffplanPaymentPlanPayload[] | null;
  attachments?: OffplanAttachmentPayload[] | null;
};

export type OffplanUnitDetails = {
  id: number;
  label: string; // e.g. "2 BR Apartment"
  priceLabel: string; // e.g. "4,135,194 AED"
  sizeLabel: string; // e.g. "2,235 sqft"
  metaLabel: string; // e.g. "Off plan · Floor 2"
};

export type OffplanPaymentPhaseDetails = {
  id: string;
  label: string;
  value: number;
};

export type OffplanPaymentPlanDetails = {
  id: number;
  title: string;
  phases: OffplanPaymentPhaseDetails[];
};

export type OffplanAttachmentDetails = {
  id: number;
  name: string;
  url: string;
};

export type OffplanDetails = {
  referenceId: string;
  title: string;
  description: string;
  locationLabel: string;
  developerName: string;
  developerWebsite?: string;
  deliveryDateLabel: string;
  priceRangeLabel: string;
  amenities: string[];
  units: OffplanUnitDetails[];
  paymentPlans: OffplanPaymentPlanDetails[];
  images: string[];
  attachments: OffplanAttachmentDetails[];
};

function parseNumberLike(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) ? n : null;
}

function formatAed(n: number): string {
  return `${n.toLocaleString()} AED`;
}

export function mapOffplanPayloadToDetails(payload: OffplanPropertyDetailsPayload): OffplanDetails {
  const emirate = payload.emirate?.name?.trim() || '';
  const district = payload.district?.name?.trim() || '';
  const locationLabel = [district, emirate].filter(Boolean).join(', ') || 'UAE';

  const from = parseNumberLike(payload.price?.from);
  const to = parseNumberLike(payload.price?.to);
  const priceRangeLabel =
    from && to
      ? `From ${formatAed(from)} - ${formatAed(to)}`
      : from
        ? `From ${formatAed(from)}`
        : to
          ? `Up to ${formatAed(to)}`
          : 'Price on request';

  const developerName = payload.developer?.name?.trim() || 'Unknown developer';
  const developerWebsite = payload.developer?.site?.trim() || '';
  const deliveryDateLabel = payload.handover_at?.trim() || '';

  const images = (payload.media ?? [])
    .map((m) => (m?.url || m?.upload?.url || '')?.trim())
    .filter((u): u is string => Boolean(u));

  const amenities = (payload.amenities ?? [])
    .map((a) => (a?.name || '')?.trim())
    .filter((n): n is string => Boolean(n));

  const attachments = (payload.attachments ?? [])
    .map((a) => {
      const url = (a?.url || a?.upload?.url || '')?.trim();
      const name = (a?.upload?.name || '')?.trim();
      return {
        id: Number(a?.id ?? 0),
        url,
        name: name || url,
      };
    })
    .filter((a) => Number.isFinite(a.id) && a.id > 0 && Boolean(a.url));

  const paymentPlans = (payload.payment_plan ?? [])
    .map((p) => {
      const phases = (p?.phases ?? [])
        .map((ph) => ({
          id: String(ph?.id ?? ''),
          label: (ph?.label ?? '').trim(),
          value: typeof ph?.value === 'number' ? ph.value : Number(ph?.value ?? 0),
        }))
        .filter((ph) => ph.id && ph.label);

      return {
        id: Number(p?.id ?? 0),
        title: (p?.title ?? '').trim() || 'Payment plan',
        phases,
      };
    })
    .filter((p) => Number.isFinite(p.id) && p.id > 0 && p.phases.length > 0);

  const units: OffplanUnitDetails[] = (payload.units ?? [])
    .map((u) => {
      const price = parseNumberLike(u?.price);
      const square = parseNumberLike(u?.square);

      const labelParts = [(u?.layout || '').trim(), (u?.type || '').trim()].filter(Boolean);
      const label = labelParts.join(' ') || 'Unit';

      const priceLabel = price ? formatAed(price) : 'Price on request';
      const sizeLabel = square ? `${Math.round(square).toLocaleString()} sqft` : '';

      const metaBits = [(u?.type_of_sale || '').trim(), u?.floor ? `Floor ${String(u.floor).trim()}` : '']
        .filter(Boolean)
        .map((s) => s.replace(/_/g, ' '));

      return {
        id: Number(u?.id ?? 0),
        label,
        priceLabel,
        sizeLabel,
        metaLabel: metaBits.join(' · '),
      };
    })
    .filter((u) => Number.isFinite(u.id) && u.id > 0);

  return {
    referenceId: payload.reference_id,
    title: payload.title || 'Offplan property',
    description: payload.description || '',
    locationLabel,
    developerName,
    developerWebsite: developerWebsite || undefined,
    deliveryDateLabel: deliveryDateLabel || 'TBA',
    priceRangeLabel,
    amenities,
    units,
    paymentPlans,
    images,
    attachments,
  };
}

export function isOffplanApiResponsePayload(payload: any): payload is OffplanPropertyDetailsPayload {
  return Boolean(payload && typeof payload === 'object' && typeof payload.reference_id === 'string' && payload.type === 'offplan');
}
