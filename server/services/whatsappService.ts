import Twilio from 'twilio';
import { db } from '../db';
import { whatsappConfig } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../storage';

const TWILIO_ACCOUNT_SID_KEY = 'twilio_account_sid';
const TWILIO_AUTH_TOKEN_KEY = 'twilio_auth_token';
const TWILIO_PROVIDER = 'twilio';

let twilioClient: Twilio.Twilio | null = null;
let cachedCredentials: { accountSid: string; authToken: string } | null = null;

export interface WhatsappConnectionStatus {
  isConnected: boolean;
  whatsappNumber: string | null;
  accountSid: string | null;
  connectionStatus: string;
  lastChecked: Date | null;
  error?: string;
}

export interface InboundMessage {
  messageSid: string;
  from: string;
  to: string;
  body: string;
  numMedia: number;
  mediaUrls: string[];
  mediaContentTypes: string[];
  profileName?: string;
}

export interface StatusCallback {
  messageSid: string;
  messageStatus: string;
  errorCode?: string;
  errorMessage?: string;
}

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
}

export async function getTwilioCredentials(): Promise<TwilioCredentials | null> {
  const accountSid = await storage.getPlatformSecret(TWILIO_ACCOUNT_SID_KEY);
  const authToken = await storage.getPlatformSecret(TWILIO_AUTH_TOKEN_KEY);

  if (!accountSid || !authToken) {
    return null;
  }

  return { accountSid, authToken };
}

export async function setTwilioCredentials(
  accountSid: string,
  authToken: string,
  userId?: string
): Promise<void> {
  await storage.setPlatformSecret(TWILIO_ACCOUNT_SID_KEY, accountSid, TWILIO_PROVIDER, userId);
  await storage.setPlatformSecret(TWILIO_AUTH_TOKEN_KEY, authToken, TWILIO_PROVIDER, userId);
  twilioClient = null;
  cachedCredentials = null;
}

async function getWhatsappNumber(): Promise<string | null> {
  const config = await storage.getWhatsappConfig();
  return config?.whatsappNumber || null;
}

async function getTwilioClient(): Promise<Twilio.Twilio> {
  const creds = await getTwilioCredentials();

  if (!creds) {
    throw new Error('WhatsApp/Twilio is not configured');
  }

  if (
    !twilioClient ||
    !cachedCredentials ||
    cachedCredentials.accountSid !== creds.accountSid ||
    cachedCredentials.authToken !== creds.authToken
  ) {
    twilioClient = Twilio(creds.accountSid, creds.authToken);
    cachedCredentials = { accountSid: creds.accountSid, authToken: creds.authToken };
  }

  return twilioClient;
}

function getWhatsappFrom(number: string): string {
  return number.startsWith('whatsapp:') ? number : `whatsapp:${number}`;
}

export async function sendTextMessage(
  to: string,
  body: string
): Promise<{ sid: string; status: string }> {
  const client = await getTwilioClient();
  const whatsappNumber = await getWhatsappNumber();

  if (!whatsappNumber) {
    throw new Error('WhatsApp number not configured');
  }

  const message = await client.messages.create({
    from: getWhatsappFrom(whatsappNumber),
    to: getWhatsappFrom(to),
    body,
  });

  console.log(`[WHATSAPP] Sent message ${message.sid} to ${to}`);
  return { sid: message.sid, status: message.status };
}

export async function sendTemplateMessage(
  to: string,
  contentSid: string,
  templateParams: Record<string, string> = {}
): Promise<{ sid: string; status: string }> {
  const client = await getTwilioClient();
  const whatsappNumber = await getWhatsappNumber();

  if (!whatsappNumber) {
    throw new Error('WhatsApp number not configured');
  }

  const contentVariables = Object.keys(templateParams).length > 0
    ? JSON.stringify(templateParams)
    : undefined;

  const createOptions: {
    from: string;
    to: string;
    contentSid: string;
    contentVariables?: string;
  } = {
    from: getWhatsappFrom(whatsappNumber),
    to: getWhatsappFrom(to),
    contentSid,
  };

  if (contentVariables) {
    createOptions.contentVariables = contentVariables;
  }

  const message = await client.messages.create(createOptions);

  console.log(`[WHATSAPP] Sent template message ${message.sid} to ${to}`);
  return { sid: message.sid, status: message.status };
}

interface TwilioWebhookBody {
  MessageSid?: string;
  SmsSid?: string;
  From?: string;
  To?: string;
  Body?: string;
  NumMedia?: string;
  ProfileName?: string;
  MessageStatus?: string;
  SmsStatus?: string;
  ErrorCode?: string;
  ErrorMessage?: string;
  [key: string]: string | undefined;
}

export function parseInboundMessage(body: TwilioWebhookBody): InboundMessage {
  const numMedia = parseInt(body.NumMedia || '0', 10);
  const mediaUrls: string[] = [];
  const mediaContentTypes: string[] = [];

  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = body[`MediaUrl${i}`];
    if (mediaUrl) {
      mediaUrls.push(mediaUrl);
    }
    const mediaType = body[`MediaContentType${i}`];
    if (mediaType) {
      mediaContentTypes.push(mediaType);
    }
  }

  return {
    messageSid: body.MessageSid || body.SmsSid || '',
    from: (body.From || '').replace('whatsapp:', ''),
    to: (body.To || '').replace('whatsapp:', ''),
    body: body.Body || '',
    numMedia,
    mediaUrls,
    mediaContentTypes,
    profileName: body.ProfileName,
  };
}

export function parseStatusCallback(body: TwilioWebhookBody): StatusCallback {
  return {
    messageSid: body.MessageSid || body.SmsSid || '',
    messageStatus: (body.MessageStatus || body.SmsStatus || '').toLowerCase(),
    errorCode: body.ErrorCode,
    errorMessage: body.ErrorMessage,
  };
}

export async function checkConnectionStatus(): Promise<WhatsappConnectionStatus> {
  const creds = await getTwilioCredentials();
  const config = await storage.getWhatsappConfig();

  if (!creds) {
    return {
      isConnected: false,
      whatsappNumber: config?.whatsappNumber || null,
      accountSid: null,
      connectionStatus: 'not_configured',
      lastChecked: null,
      error: 'Twilio credentials not configured',
    };
  }

  try {
    const client = Twilio(creds.accountSid, creds.authToken);
    const account = await client.api.accounts(creds.accountSid).fetch();

    const isConnected = account.status === 'active';
    const connectionStatus = isConnected ? 'connected' : 'error';

    if (config) {
      await db.update(whatsappConfig)
        .set({
          lastConnectionCheck: new Date(),
          connectionStatus,
          updatedAt: new Date(),
        })
        .where(eq(whatsappConfig.id, config.id));
    }

    return {
      isConnected,
      whatsappNumber: config?.whatsappNumber || null,
      accountSid: creds.accountSid,
      connectionStatus,
      lastChecked: new Date(),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WHATSAPP] Connection check failed:', errorMessage);

    if (config) {
      await db.update(whatsappConfig)
        .set({
          lastConnectionCheck: new Date(),
          connectionStatus: 'error',
          updatedAt: new Date(),
        })
        .where(eq(whatsappConfig.id, config.id));
    }

    return {
      isConnected: false,
      whatsappNumber: config?.whatsappNumber || null,
      accountSid: creds.accountSid,
      connectionStatus: 'error',
      lastChecked: new Date(),
      error: errorMessage,
    };
  }
}

export async function getAuthToken(): Promise<string | null> {
  const creds = await getTwilioCredentials();
  return creds?.authToken || null;
}

export function buildCanonicalWebhookUrl(req: { protocol: string; get: (header: string) => string | undefined; originalUrl: string }): string {
  const forwardedProto = req.get('x-forwarded-proto');
  const protocol = forwardedProto || req.protocol;
  const host = req.get('host') || '';
  return `${protocol}://${host}${req.originalUrl}`;
}

export function validateTwilioRequest(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  try {
    return Twilio.validateRequest(authToken, signature, url, params);
  } catch (error) {
    console.error('[WHATSAPP] Signature validation error:', error);
    return false;
  }
}
