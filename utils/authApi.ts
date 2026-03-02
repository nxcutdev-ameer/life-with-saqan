import { fetchJson } from '@/utils/api';

const BASE_URL = 'https://backoffice.vzite.com/api/v1/auth';

export type AuthByPhoneResponse = {
  success: boolean;
  message?: string;
  payload?: {
    action?: 'login' | 'register' | string;
  };
};

export type AuthMethod = 'whatsapp' | 'sms';

// Unified endpoint that decides whether this phone should login or register.
export async function authByPhone(phone: string, method: AuthMethod = 'whatsapp'): Promise<AuthByPhoneResponse> {
  return fetchJson<AuthByPhoneResponse>(`${BASE_URL}`, {
    method: 'POST',
    timeoutMs: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone, method }),
  });
}

export type RegisterPhoneOtpResponse = {
  success?: boolean;
  message?: string;
  payload?: {
    brokerExist?: boolean;
    agent?: { id: number; name: string };
    saqancom_token?: string;
    backoffice_token?: string;
    properties_token?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type LoginPhoneOtpResponse = {
  success?: boolean | string;
  message?: string;
  payload?: {
    agent?: { id: number; name: string };
    saqancom_token?: string;
    backoffice_token?: string;
    properties_token?: string;
    [key: string]: unknown;
  };
  data?: {
    agent?: { id: number; name: string };
    saqancom_token?: string;
    backoffice_token?: string;
    properties_token?: string;
    [key: string]: unknown;
  };
  status?: boolean;
};

export async function verifyRegisterPhoneOtp(params: {
  phone: string;
  otpCode: string;
}): Promise<RegisterPhoneOtpResponse> {
  return fetchJson<RegisterPhoneOtpResponse>(`${BASE_URL}/register/phone/otp`, {
    method: 'POST',
    timeoutMs: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone: params.phone,
      otp_code: params.otpCode,
    }),
  });
}

export async function verifyLoginPhoneOtp(params: {
  phone: string;
  otpCode: string;
}): Promise<LoginPhoneOtpResponse> {
  return fetchJson<LoginPhoneOtpResponse>(`${BASE_URL}/login/phone/otp`, {
    method: 'POST',
    timeoutMs: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone: params.phone,
      otp_code: params.otpCode,
    }),
  });
}
