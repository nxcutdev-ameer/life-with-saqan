import { fetchJson } from '@/utils/api';

const BASE_URL = 'https://backoffice.vzite.com/api/v1/profile';

export type UpdateBrokerIdResponse = {
  success: boolean;
  message?: string;
  [key: string]: unknown;
};

export async function updateBrokerId(params: {
  brokerNumber: string;
  backofficeToken: string;
}): Promise<UpdateBrokerIdResponse> {
  return fetchJson<UpdateBrokerIdResponse>(`${BASE_URL}/update-brokerid`, {
    method: 'POST',
    timeoutMs: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.backofficeToken}`,
    },
    body: JSON.stringify({ broker_number: params.brokerNumber }),
  });
}
