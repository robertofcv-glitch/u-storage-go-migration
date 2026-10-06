import { google } from 'googleapis';
import type { StorageMoveContext } from '@shared/storageMoveContext';

/** Shared operational context rendered in every quote-related message. */
export function renderStorageMoveContext(context: StorageMoveContext | undefined, language: string = 'es'): string {
  if (!context) return '';
  const es = language === 'es';
  const label = es ? context.labels.serviceEs : context.labels.serviceEn;
  const direction = es ? context.labels.directionEs : context.labels.directionEn;
  const branch = context.branch;
  return `<div class="move-context" style="background:#F4EFF7;padding:15px;border-radius:8px;margin:15px 0;">
    <strong>${es ? 'Tipo de servicio' : 'Service type'}:</strong> ${label}
    ${direction ? `<br><strong>${es ? 'Dirección' : 'Direction'}:</strong> ${direction}` : ''}
    ${branch ? `<br><strong>${es ? 'Bodega' : 'Storage branch'}:</strong> ${branch.brand} ${branch.name}<br>
      <strong>${es ? 'Dirección de bodega' : 'Branch address'}:</strong> ${branch.address}<br>
      <strong>Google Place ID:</strong> ${branch.googlePlaceId}` : ''}
  </div>`;
}

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

async function getGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Email sender alias - must be configured in Gmail account settings
// NOTE: keep hola@rukumove.com until the U-Storage Go domain alias is verified in Gmail
const SENDER_EMAIL = 'hola@rukumove.com';
const SENDER_NAME = 'Clara de U-Storage Go';

export function applyUStorageGoEmailBrand(html: string): string {
  return html
    .replace(/Arial,\s*sans-serif/gi, "'Montserrat', Arial, sans-serif")
    .replace(/#1A1A1A/gi, '#24152E')
    .replace(/#EF7521/gi, '#FF6C00')
    .replace(/#502864/gi, '#4E2069')
    .replace(/background:\s*#FF6C00;\s*color:\s*white/gi, 'background: #FF6C00; color: #24152E')
    .replace(/background-color:\s*#FF6C00;\s*color:\s*white/gi, 'background-color: #FF6C00; color: #24152E')
    .replace(/border-radius:\s*5px/gi, 'border-radius: 8px');
}

export interface GmailConnectionStatus {
  isConnected: boolean;
  primaryEmail: string | null;
  sendAsAddresses: Array<{ email: string; displayName: string; isDefault: boolean; isPrimary: boolean }>;
  error?: string;
}

export async function checkGmailConnectionStatus(): Promise<GmailConnectionStatus> {
  try {
    // Just try to get an access token - if this works, Gmail is connected
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      throw new Error('No access token available');
    }
    
    // Connection is successful if we have an access token
    // The configured sender alias (hola@rukumove.com) is set up in Gmail settings
    const sendAsAddresses = [
      { 
        email: SENDER_EMAIL, 
        displayName: SENDER_NAME, 
        isDefault: true, 
        isPrimary: false 
      }
    ];
    
    return {
      isConnected: true,
      primaryEmail: SENDER_EMAIL,
      sendAsAddresses,
    };
  } catch (error: any) {
    console.error('[EMAIL] Gmail connection check failed:', error.message);
    return {
      isConnected: false,
      primaryEmail: null,
      sendAsAddresses: [],
      error: error.message,
    };
  }
}

function createEmailMessage(to: string, subject: string, htmlBody: string, fromName: string = SENDER_NAME): string {
  const message = [
    `From: ${fromName} <${SENDER_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    applyUStorageGoEmailBrand(htmlBody)
  ].join('\r\n');

  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  data: string; // Base64 encoded
}

function createEmailMessageWithAttachment(
  to: string, 
  subject: string, 
  htmlBody: string, 
  attachment: EmailAttachment,
  fromName: string = SENDER_NAME
): string {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  const message = [
    `From: ${fromName} <${SENDER_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    applyUStorageGoEmailBrand(htmlBody),
    '',
    `--${boundary}`,
    `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${attachment.filename}"`,
    '',
    attachment.data,
    '',
    `--${boundary}--`
  ].join('\r\n');

  return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendEmailWithAttachment(
  to: string, 
  subject: string, 
  htmlBody: string, 
  attachment: EmailAttachment
): Promise<boolean> {
  try {
    const gmail = await getGmailClient();
    const raw = createEmailMessageWithAttachment(to, subject, htmlBody, attachment);
    
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: raw
      }
    });
    
    console.log(`[EMAIL] Successfully sent email with attachment to ${to}: ${subject}`);
    return true;
  } catch (error: any) {
    console.error(`[EMAIL] Failed to send email with attachment to ${to}:`, error.message);
    return false;
  }
}

export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
  try {
    const gmail = await getGmailClient();
    const raw = createEmailMessage(to, subject, htmlBody);
    
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: raw
      }
    });
    
    console.log(`[EMAIL] Successfully sent email to ${to}: ${subject}`);
    return true;
  } catch (error: any) {
    console.error(`[EMAIL] Failed to send email to ${to}:`, error.message);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, resetLink: string, language: string = 'es'): Promise<boolean> {
  const isSpanish = language === 'es';
  
  const subject = isSpanish 
    ? 'Restablece tu contraseña - U-Storage Go' 
    : 'Reset Your Password - U-Storage Go';
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1A1A1A; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #EF7521; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>U-Storage Go</h1>
        </div>
        <div class="content">
          <h2>${isSpanish ? 'Restablece tu contraseña' : 'Reset Your Password'}</h2>
          <p>${isSpanish 
            ? 'Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña.' 
            : 'We received a request to reset your password. Click the button below to create a new password.'}</p>
          <p style="text-align: center;">
            <a href="${resetLink}" class="button">${isSpanish ? 'Restablecer Contraseña' : 'Reset Password'}</a>
          </p>
          <p>${isSpanish 
            ? 'Si no solicitaste restablecer tu contraseña, puedes ignorar este correo.' 
            : 'If you did not request a password reset, you can ignore this email.'}</p>
          <p>${isSpanish 
            ? 'Este enlace expira en 1 hora.' 
            : 'This link expires in 1 hour.'}</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} U-Storage Go. ${isSpanish ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(to, subject, htmlBody);
}

export async function sendAdminApprovalEmail(to: string, fullName: string, passwordSetupLink: string, language: string = 'es'): Promise<boolean> {
  const isSpanish = language === 'es';
  
  const subject = isSpanish 
    ? '¡Tu acceso de administrador ha sido aprobado! - U-Storage Go' 
    : 'Your Admin Access Has Been Approved! - U-Storage Go';
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1A1A1A; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #EF7521; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .success-badge { background: #10B981; color: white; padding: 5px 15px; border-radius: 15px; display: inline-block; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>U-Storage Go</h1>
        </div>
        <div class="content">
          <p style="text-align: center;"><span class="success-badge">${isSpanish ? '¡Aprobado!' : 'Approved!'}</span></p>
          <h2>${isSpanish ? `¡Hola ${fullName}!` : `Hello ${fullName}!`}</h2>
          <p>${isSpanish 
            ? 'Tu solicitud de acceso de administrador ha sido aprobada. Ahora puedes configurar tu contraseña y acceder al panel de administración.' 
            : 'Your admin access request has been approved. You can now set up your password and access the admin dashboard.'}</p>
          <p style="text-align: center;">
            <a href="${passwordSetupLink}" class="button">${isSpanish ? 'Configurar Contraseña' : 'Set Up Password'}</a>
          </p>
          <p>${isSpanish 
            ? 'Este enlace expira en 7 días.' 
            : 'This link expires in 7 days.'}</p>
          <p>${isSpanish 
            ? 'Después de configurar tu contraseña, podrás iniciar sesión en el panel de administración.' 
            : 'After setting up your password, you can log in to the admin dashboard.'}</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} U-Storage Go. ${isSpanish ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(to, subject, htmlBody);
}

export async function sendAdminAccessDeniedEmail(to: string, fullName: string, reason: string | null, language: string = 'es'): Promise<boolean> {
  const isSpanish = language === 'es';
  
  const subject = isSpanish 
    ? 'Actualización sobre tu solicitud de acceso - U-Storage Go' 
    : 'Update on Your Access Request - U-Storage Go';
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1A1A1A; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .reason-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>U-Storage Go</h1>
        </div>
        <div class="content">
          <h2>${isSpanish ? `Hola ${fullName}` : `Hello ${fullName}`}</h2>
          <p>${isSpanish 
            ? 'Gracias por tu interés en ser administrador de U-Storage Go. Después de revisar tu solicitud, lamentamos informarte que no podemos aprobar tu acceso en este momento.' 
            : 'Thank you for your interest in becoming a U-Storage Go administrator. After reviewing your request, we regret to inform you that we are unable to approve your access at this time.'}</p>
          ${reason ? `
          <div class="reason-box">
            <strong>${isSpanish ? 'Nota del revisor:' : "Reviewer's note:"}</strong><br>
            ${reason}
          </div>
          ` : ''}
          <p>${isSpanish 
            ? 'Si crees que esto fue un error o tienes preguntas, por favor contacta a nuestro equipo de soporte.' 
            : 'If you believe this was an error or have questions, please contact our support team.'}</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} U-Storage Go. ${isSpanish ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(to, subject, htmlBody);
}

export async function isEmailServiceAvailable(): Promise<boolean> {
  try {
    await getGmailClient();
    return true;
  } catch {
    return false;
  }
}

// ============================================
// WELCOME EMAIL - New User Registration
// ============================================
export async function sendWelcomeEmail(
  to: string, 
  fullName: string, 
  dashboardLink: string,
  language: string = 'es'
): Promise<boolean> {
  const isSpanish = language === 'es';
  
  const subject = isSpanish 
    ? '¡Bienvenido a U-Storage Go!' 
    : 'Welcome to U-Storage Go!';
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1A1A1A; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #EF7521; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .welcome-badge { background: #10B981; color: white; padding: 5px 15px; border-radius: 15px; display: inline-block; }
        .features { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .feature-item { padding: 10px 0; border-bottom: 1px solid #eee; }
        .feature-item:last-child { border-bottom: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>U-Storage Go</h1>
        </div>
        <div class="content">
          <p style="text-align: center;"><span class="welcome-badge">${isSpanish ? '¡Bienvenido!' : 'Welcome!'}</span></p>
          <h2>${isSpanish ? `¡Hola ${fullName}!` : `Hello ${fullName}!`}</h2>
          <p>${isSpanish 
            ? 'Gracias por unirte a U-Storage Go. Estamos emocionados de ayudarte con tu próxima mudanza.' 
            : 'Thank you for joining U-Storage Go. We are excited to help you with your next move.'}</p>
          
          <div class="features">
            <h3>${isSpanish ? '¿Qué puedes hacer?' : 'What can you do?'}</h3>
            <div class="feature-item">✅ ${isSpanish ? 'Solicitar cotizaciones de mudanza' : 'Request moving quotes'}</div>
            <div class="feature-item">✅ ${isSpanish ? 'Comparar ofertas de diferentes empresas' : 'Compare offers from different companies'}</div>
            <div class="feature-item">✅ ${isSpanish ? 'Usar nuestro asistente de inventario con IA' : 'Use our AI inventory assistant'}</div>
            <div class="feature-item">✅ ${isSpanish ? 'Seguir el estado de tu mudanza' : 'Track your move status'}</div>
          </div>
          
          <p style="text-align: center;">
            <a href="${dashboardLink}" class="button">${isSpanish ? 'Ir a Mi Panel' : 'Go to My Dashboard'}</a>
          </p>
          <p>${isSpanish 
            ? 'Si tienes alguna pregunta, no dudes en contactarnos.' 
            : 'If you have any questions, feel free to contact us.'}</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} U-Storage Go. ${isSpanish ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(to, subject, htmlBody);
}

// ============================================
// QUOTE CONFIRMATION - Client submits quote
// ============================================
export async function sendQuoteConfirmationEmail(
  to: string,
  fullName: string,
  quoteNumber: string,
  originCity: string,
  destinationCity: string,
  moveDate: string,
  dashboardLink: string,
  language: string = 'es',
  moveContext?: StorageMoveContext
): Promise<boolean> {
  const isSpanish = language === 'es';
  
  const subject = isSpanish 
    ? `Cotización ${quoteNumber} recibida - U-Storage Go` 
    : `Quote ${quoteNumber} Received - U-Storage Go`;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1A1A1A; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #EF7521; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .quote-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #EF7521; }
        .quote-number { font-size: 24px; font-weight: bold; color: #1A1A1A; }
        .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; width: 40%; }
        .detail-value { width: 60%; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>U-Storage Go</h1>
        </div>
        <div class="content">
          ${renderStorageMoveContext(moveContext, language)}
          <h2>${isSpanish ? `¡Hola ${fullName}!` : `Hello ${fullName}!`}</h2>
          <p>${isSpanish 
            ? 'Hemos recibido tu solicitud de cotización. Nuestros socios de mudanza revisarán tu solicitud y te enviarán ofertas pronto.' 
            : 'We have received your quote request. Our moving partners will review your request and send you offers soon.'}</p>
          
          <div class="quote-box">
            <p class="quote-number">${quoteNumber}</p>
            <div class="detail-row">
              <span class="detail-label">${isSpanish ? 'Origen:' : 'Origin:'}</span>
              <span class="detail-value">${originCity}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">${isSpanish ? 'Destino:' : 'Destination:'}</span>
              <span class="detail-value">${destinationCity}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">${isSpanish ? 'Fecha de mudanza:' : 'Move date:'}</span>
              <span class="detail-value">${moveDate}</span>
            </div>
          </div>
          
          <p>${isSpanish 
            ? 'Te notificaremos cuando recibas ofertas de nuestros socios de mudanza.' 
            : 'We will notify you when you receive offers from our moving partners.'}</p>
          
          <p style="text-align: center;">
            <a href="${dashboardLink}" class="button">${isSpanish ? 'Ver Mi Cotización' : 'View My Quote'}</a>
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} U-Storage Go. ${isSpanish ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(to, subject, htmlBody);
}

// ============================================
// QUOTE INVITATION - Mover invited to bid
// ============================================
export async function sendQuoteInvitationEmail(
  to: string,
  companyName: string,
  quoteNumber: string,
  originCity: string,
  destinationCity: string,
  moveDate: string,
  estimatedVolume: string,
  bidDeadline: string,
  dashboardLink: string,
  language: string = 'es',
  moveContext?: StorageMoveContext
): Promise<boolean> {
  const isSpanish = language === 'es';
  
  const subject = isSpanish 
    ? `Nueva oportunidad de cotización: ${quoteNumber} - U-Storage Go` 
    : `New Quote Opportunity: ${quoteNumber} - U-Storage Go`;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1A1A1A; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #EF7521; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .opportunity-badge { background: #F59E0B; color: white; padding: 5px 15px; border-radius: 15px; display: inline-block; }
        .quote-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #F59E0B; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #1A1A1A; }
        .deadline-warning { background: #FEF3C7; padding: 15px; border-radius: 8px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>U-Storage Go</h1>
        </div>
        <div class="content">
          ${renderStorageMoveContext(moveContext, language)}
          <p style="text-align: center;"><span class="opportunity-badge">${isSpanish ? '¡Nueva Oportunidad!' : 'New Opportunity!'}</span></p>
          <h2>${isSpanish ? `¡Hola ${companyName}!` : `Hello ${companyName}!`}</h2>
          <p>${isSpanish 
            ? 'Has sido invitado a cotizar un nuevo servicio de mudanza. Revisa los detalles y envía tu oferta.' 
            : 'You have been invited to quote a new moving service. Review the details and submit your offer.'}</p>
          
          <div class="quote-box">
            <p style="font-size: 18px; font-weight: bold; color: #1A1A1A;">${quoteNumber}</p>
            <div class="detail-row">
              <span class="detail-label">${isSpanish ? 'Origen:' : 'Origin:'}</span> ${originCity}
            </div>
            <div class="detail-row">
              <span class="detail-label">${isSpanish ? 'Destino:' : 'Destination:'}</span> ${destinationCity}
            </div>
            <div class="detail-row">
              <span class="detail-label">${isSpanish ? 'Fecha de mudanza:' : 'Move date:'}</span> ${moveDate}
            </div>
            <div class="detail-row">
              <span class="detail-label">${isSpanish ? 'Volumen estimado:' : 'Estimated volume:'}</span> ${estimatedVolume}
            </div>
            <div class="deadline-warning">
              ⏰ <strong>${isSpanish ? 'Fecha límite para ofertar:' : 'Bid deadline:'}</strong> ${bidDeadline}
            </div>
          </div>
          
          <p style="text-align: center;">
            <a href="${dashboardLink}" class="button">${isSpanish ? 'Ver Detalles y Ofertar' : 'View Details & Submit Bid'}</a>
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} U-Storage Go. ${isSpanish ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(to, subject, htmlBody);
}

// ============================================
// BID RECEIVED - Client notified of new bid
// ============================================
export async function sendBidReceivedEmail(
  to: string,
  clientName: string,
  quoteNumber: string,
  companyName: string,
  bidAmount: string,
  dashboardLink: string,
  language: string = 'es',
  moveContext?: StorageMoveContext
): Promise<boolean> {
  const isSpanish = language === 'es';
  
  const subject = isSpanish 
    ? `Nueva oferta recibida para ${quoteNumber} - U-Storage Go` 
    : `New Bid Received for ${quoteNumber} - U-Storage Go`;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1A1A1A; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #EF7521; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .bid-box { background: white; padding: 25px; margin: 20px 0; border-radius: 8px; text-align: center; border: 2px solid #10B981; }
        .bid-amount { font-size: 32px; font-weight: bold; color: #10B981; }
        .company-name { font-size: 18px; color: #1A1A1A; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>U-Storage Go</h1>
        </div>
        <div class="content">
          ${renderStorageMoveContext(moveContext, language)}
          <h2>${isSpanish ? `¡Hola ${clientName}!` : `Hello ${clientName}!`}</h2>
          <p>${isSpanish 
            ? `¡Buenas noticias! Has recibido una nueva oferta para tu cotización ${quoteNumber}.` 
            : `Good news! You have received a new bid for your quote ${quoteNumber}.`}</p>
          
          <div class="bid-box">
            <p class="bid-amount">${bidAmount}</p>
            <p class="company-name">${companyName}</p>
          </div>
          
          <p>${isSpanish 
            ? 'Revisa la oferta completa y compárala con otras opciones en tu panel.' 
            : 'Review the complete offer and compare it with other options in your dashboard.'}</p>
          
          <p style="text-align: center;">
            <a href="${dashboardLink}" class="button">${isSpanish ? 'Ver Todas las Ofertas' : 'View All Bids'}</a>
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} U-Storage Go. ${isSpanish ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(to, subject, htmlBody);
}

// ============================================
// BID ACCEPTED - Mover notified of acceptance
// ============================================
export async function sendBidAcceptedEmail(
  to: string,
  companyName: string,
  quoteNumber: string,
  clientName: string,
  originCity: string,
  destinationCity: string,
  moveDate: string,
  bidAmount: string,
  dashboardLink: string,
  language: string = 'es',
  moveContext?: StorageMoveContext
): Promise<boolean> {
  const isSpanish = language === 'es';
  
  const subject = isSpanish 
    ? `¡Tu oferta fue aceptada! - ${quoteNumber} - U-Storage Go` 
    : `Your Bid Was Accepted! - ${quoteNumber} - U-Storage Go`;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1A1A1A; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #EF7521; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .success-badge { background: #10B981; color: white; padding: 8px 20px; border-radius: 15px; display: inline-block; font-size: 18px; }
        .job-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #10B981; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #eee; }
        .detail-label { font-weight: bold; color: #1A1A1A; }
        .amount-highlight { font-size: 24px; font-weight: bold; color: #10B981; text-align: center; padding: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>U-Storage Go</h1>
        </div>
        <div class="content">
          <p style="text-align: center;"><span class="success-badge">${isSpanish ? '¡Felicidades!' : 'Congratulations!'}</span></p>
          ${renderStorageMoveContext(moveContext, language)}
          <h2>${isSpanish ? `¡Hola ${companyName}!` : `Hello ${companyName}!`}</h2>
          <p>${isSpanish 
            ? '¡Tu oferta ha sido aceptada! El cliente ha elegido tu empresa para realizar su mudanza.' 
            : 'Your bid has been accepted! The client has chosen your company for their move.'}</p>
          
          <div class="job-box">
            <p style="font-size: 18px; font-weight: bold; color: #1A1A1A;">${quoteNumber}</p>
            <div class="detail-row">
              <span class="detail-label">${isSpanish ? 'Cliente:' : 'Client:'}</span> ${clientName}
            </div>
            <div class="detail-row">
              <span class="detail-label">${isSpanish ? 'Origen:' : 'Origin:'}</span> ${originCity}
            </div>
            <div class="detail-row">
              <span class="detail-label">${isSpanish ? 'Destino:' : 'Destination:'}</span> ${destinationCity}
            </div>
            <div class="detail-row">
              <span class="detail-label">${isSpanish ? 'Fecha de mudanza:' : 'Move date:'}</span> ${moveDate}
            </div>
            <div class="amount-highlight">
              ${bidAmount}
            </div>
          </div>
          
          <p>${isSpanish 
            ? 'Por favor, coordina los detalles finales con el cliente. Encontrarás su información de contacto en tu panel.' 
            : 'Please coordinate the final details with the client. You will find their contact information in your dashboard.'}</p>
          
          <p style="text-align: center;">
            <a href="${dashboardLink}" class="button">${isSpanish ? 'Ver Detalles del Trabajo' : 'View Job Details'}</a>
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} U-Storage Go. ${isSpanish ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(to, subject, htmlBody);
}

// ============================================
// QUOTE STATUS UPDATE - Generic status change
// ============================================
export async function sendQuoteStatusUpdateEmail(
  to: string,
  recipientName: string,
  quoteNumber: string,
  newStatus: 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
  additionalInfo: string | null,
  dashboardLink: string,
  language: string = 'es',
  moveContext?: StorageMoveContext
): Promise<boolean> {
  const isSpanish = language === 'es';
  
  const statusLabels: Record<string, { es: string; en: string; color: string; icon: string }> = {
    scheduled: { es: 'Programada', en: 'Scheduled', color: '#3B82F6', icon: '📅' },
    in_progress: { es: 'En Progreso', en: 'In Progress', color: '#F59E0B', icon: '🚚' },
    completed: { es: 'Completada', en: 'Completed', color: '#10B981', icon: '✅' },
    cancelled: { es: 'Cancelada', en: 'Cancelled', color: '#EF4444', icon: '❌' },
  };
  
  const status = statusLabels[newStatus];
  const statusLabel = isSpanish ? status.es : status.en;
  
  const subject = isSpanish 
    ? `Actualización de tu mudanza ${quoteNumber}: ${statusLabel} - U-Storage Go` 
    : `Moving Update ${quoteNumber}: ${statusLabel} - U-Storage Go`;
  
  const statusMessages: Record<string, { es: string; en: string }> = {
    scheduled: {
      es: 'Tu mudanza ha sido programada. El equipo de mudanza se comunicará contigo para confirmar los detalles finales.',
      en: 'Your move has been scheduled. The moving team will contact you to confirm the final details.'
    },
    in_progress: {
      es: '¡Tu mudanza está en progreso! El equipo de mudanza está trabajando en tu traslado.',
      en: 'Your move is in progress! The moving team is working on your relocation.'
    },
    completed: {
      es: '¡Tu mudanza ha sido completada exitosamente! Esperamos que todo haya ido bien.',
      en: 'Your move has been completed successfully! We hope everything went well.'
    },
    cancelled: {
      es: 'Tu solicitud de mudanza ha sido cancelada.',
      en: 'Your moving request has been cancelled.'
    }
  };
  
  const message = statusMessages[newStatus];
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1A1A1A; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #EF7521; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .status-box { background: white; padding: 25px; margin: 20px 0; border-radius: 8px; text-align: center; border-left: 4px solid ${status.color}; }
        .status-icon { font-size: 48px; }
        .status-label { font-size: 24px; font-weight: bold; color: ${status.color}; margin-top: 10px; }
        .quote-number { font-size: 14px; color: #666; margin-top: 5px; }
        .info-box { background: #F3F4F6; padding: 15px; border-radius: 8px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>U-Storage Go</h1>
        </div>
        <div class="content">
          ${renderStorageMoveContext(moveContext, language)}
          <h2>${isSpanish ? `Hola ${recipientName}` : `Hello ${recipientName}`}</h2>
          
          <div class="status-box">
            <div class="status-icon">${status.icon}</div>
            <div class="status-label">${statusLabel}</div>
            <div class="quote-number">${quoteNumber}</div>
          </div>
          
          <p>${isSpanish ? message.es : message.en}</p>
          
          ${additionalInfo ? `
          <div class="info-box">
            <strong>${isSpanish ? 'Información adicional:' : 'Additional information:'}</strong><br>
            ${additionalInfo}
          </div>
          ` : ''}
          
          ${newStatus === 'completed' ? `
          <p>${isSpanish 
            ? '¿Cómo fue tu experiencia? Nos encantaría escuchar tu opinión.' 
            : 'How was your experience? We would love to hear your feedback.'}</p>
          ` : ''}
          
          <p style="text-align: center;">
            <a href="${dashboardLink}" class="button">${isSpanish ? 'Ver Detalles' : 'View Details'}</a>
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} U-Storage Go. ${isSpanish ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail(to, subject, htmlBody);
}

export async function sendQuotePdfEmail(
  to: string,
  recipientName: string,
  quoteNumber: string,
  pdfData: string,
  pdfFileName: string,
  dashboardLink: string,
  language: string = 'es',
  moveContext?: StorageMoveContext
): Promise<boolean> {
  const isSpanish = language === 'es';
  
  const subject = isSpanish 
    ? `Tu Cotización ${quoteNumber} - U-Storage Go` 
    : `Your Quote ${quoteNumber} - U-Storage Go`;
  
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1A1A1A; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #EF7521; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .quote-number { font-size: 24px; color: #EF7521; font-weight: bold; }
        .attachment-note { background: #E5F6F9; border-left: 4px solid #EF7521; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>U-Storage Go</h1>
        </div>
        <div class="content">
          ${renderStorageMoveContext(moveContext, language)}
          <h2>${isSpanish ? '¡Hola' : 'Hello'} ${recipientName}!</h2>
          
          <p>${isSpanish 
            ? 'Gracias por solicitar una cotización con U-Storage Go. Adjunto encontrarás el documento PDF con todos los detalles de tu cotización.' 
            : 'Thank you for requesting a quote with U-Storage Go. Attached you will find the PDF document with all the details of your quote.'}</p>
          
          <p class="quote-number">${isSpanish ? 'Número de Cotización' : 'Quote Number'}: ${quoteNumber}</p>
          
          <div class="attachment-note">
            <strong>📎 ${isSpanish ? 'Documento adjunto' : 'Attached document'}:</strong><br>
            ${pdfFileName}
          </div>
          
          <p>${isSpanish 
            ? 'Esta cotización incluye:' 
            : 'This quote includes:'}</p>
          <ul>
            <li>${isSpanish ? 'Inventario detallado de tus artículos' : 'Detailed inventory of your items'}</li>
            <li>${isSpanish ? 'Desglose de costos' : 'Cost breakdown'}</li>
            <li>${isSpanish ? 'Información de origen y destino' : 'Origin and destination information'}</li>
            <li>${isSpanish ? 'Términos y condiciones' : 'Terms and conditions'}</li>
          </ul>
          
          <p>${isSpanish 
            ? 'Si tienes preguntas o deseas modificar tu cotización, no dudes en contactarnos.' 
            : 'If you have questions or would like to modify your quote, please don\'t hesitate to contact us.'}</p>
          
          <p style="text-align: center;">
            <a href="${dashboardLink}" class="button">${isSpanish ? 'Ver en Mi Panel' : 'View in My Dashboard'}</a>
          </p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} U-Storage Go. ${isSpanish ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
          <p>${isSpanish ? '¿Preguntas? Escríbenos a' : 'Questions? Email us at'} hola@rukumove.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  const attachment: EmailAttachment = {
    filename: pdfFileName,
    mimeType: 'application/pdf',
    data: pdfData,
  };
  
  return sendEmailWithAttachment(to, subject, htmlBody, attachment);
}
