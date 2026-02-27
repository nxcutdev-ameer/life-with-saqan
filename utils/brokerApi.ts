import { fetchJson } from '@/utils/api';

const BASE_URL = 'https://backoffice.vzite.com/api/v1/profile/broker';

export type BrokerUpdateResponse = {
  success: boolean;
  message?: string;
  payload?: {
    phone?: string;
    [key: string]: unknown;
  };
};

export async function requestBrokerIdUpdate(params: {
  backofficeToken: string;
  brokerNumber: string;
  emirate: string; // lower case
  file?: { uri: string; name: string; type: string } | null;
}): Promise<BrokerUpdateResponse> {
  const form = new FormData();
  form.append('broker_number', params.brokerNumber);
  form.append('emirate', params.emirate);
  if (params.file) {
    // @ts-expect-error RN FormData file type
    form.append('file', params.file);
  }

  return fetchJson<BrokerUpdateResponse>(`${BASE_URL}/update-brokerid`, {
    method: 'POST',
    timeoutMs: 45000,
    headers: {
      Authorization: `Bearer ${params.backofficeToken}`,
    },
    body: form as any,
  });
}

export type ValidateBrokerOtpResponse = {
  success: boolean;
  message?: string;
  errors?: unknown;
};

export async function validateBrokerOtp(params: {
  backofficeToken: string;
  otpCode: string;
}): Promise<ValidateBrokerOtpResponse> {
  return fetchJson<ValidateBrokerOtpResponse>(`${BASE_URL}/validate-otp`, {
    method: 'POST',
    timeoutMs: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.backofficeToken}`,
    },
    body: JSON.stringify({ otp_code: params.otpCode }),
  });
}
