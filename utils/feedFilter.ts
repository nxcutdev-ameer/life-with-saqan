import type { PublicVideo } from '@/utils/publicVideosApi';

export type FeedFilterKey = {
  transactionType: string;
  city: string;
};

const normalize = (v: any) => String(v ?? '').trim().toUpperCase();

// Map UI transaction types to backend `property.meta.type` values.
// UI: BUY/RENT/STAY
// Backend: SALE/RENT/STAY
export function mapUiTransactionTypeToBackendType(uiType: string) {
  const t = normalize(uiType);
  if (t === 'BUY') return 'sale';
  if (t === 'RENT') return 'RENT';
  if (t === 'STAY') return 'STAY';
  return t;
}

export function makeFeedFilterKey(params: FeedFilterKey) {
  return `${mapUiTransactionTypeToBackendType(params.transactionType)}::${normalize(params.city)}`;
}

export function strictMatchPublicVideo(v: PublicVideo, filter: FeedFilterKey) {
  const metaType = normalize(v?.property?.meta?.type);
  const emirateName = normalize(v?.property?.emirate?.name);

  return metaType === mapUiTransactionTypeToBackendType(filter.transactionType) && emirateName === normalize(filter.city);
}

export function filterPublicVideosStrict(videos: PublicVideo[], filter: FeedFilterKey) {
  return videos.filter((v) => strictMatchPublicVideo(v, filter));
}
