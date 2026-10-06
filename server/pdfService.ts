import PDFDocument from 'pdfkit';
import path from 'node:path';
import sharp from 'sharp';
import { storage } from './storage';
import type { Quote, InventoryItem, QuoteDocument } from '@shared/schema';
import { getStorageMoveContext, type StorageMoveContext } from '@shared/storageMoveContext';

// U-Storage Go brand palette
const BRAND_COLORS = {
  deepOcean: '#24152E',
  slateMist: '#6D6075',
  frostBlue: '#F4EFF7',
  horizonTeal: '#FF6C00',
  goPurple: '#4E2069',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
};

const BRAND_ASSET_ROOT = path.resolve(process.cwd(), 'client/public/brand/v1');
const MONTSERRAT_REGULAR = path.join(BRAND_ASSET_ROOT, 'fonts/montserrat-regular.ttf');
const MONTSERRAT_SEMIBOLD = path.join(BRAND_ASSET_ROOT, 'fonts/montserrat-semibold.ttf');
const OFFICIAL_LOGO = path.join(BRAND_ASSET_ROOT, 'logos/official-reverse.svg');

interface QuoteDataForPdf {
  quote: Quote;
  inventory: InventoryItem[];
  services: { name: string; nameEs: string; basePrice: string | null }[];
  addOns: { name: string; nameEs: string; price: string | null }[];
  user?: { fullName?: string | null; email?: string | null; phone?: string | null };
  moveContext: StorageMoveContext;
}

export async function generateQuotePdf(quoteId: string, language: 'es' | 'en' = 'es'): Promise<Buffer> {
  const quote = await storage.getQuote(quoteId);
  if (!quote) {
    throw new Error(`Quote not found: ${quoteId}`);
  }

  const inventory = await storage.getInventoryByQuote(quoteId);
  const services = await storage.getQuoteServices(quoteId);
  const addOns = await storage.getQuoteAddOns(quoteId);
  let user;
  if (quote.userId) {
    user = await storage.getUser(quote.userId);
  }

  const data: QuoteDataForPdf = {
    quote,
    inventory,
    services: services.map(s => ({ name: s.name, nameEs: s.nameEs || s.name, basePrice: s.basePrice })),
    addOns: addOns.map(a => ({ name: a.name, nameEs: a.nameEs || a.name, price: a.price })),
    user: user ? { fullName: user.fullName, email: user.email, phone: user.phone } : undefined,
    moveContext: getStorageMoveContext(quote),
  };

  return createPdfBuffer(data, language);
}

async function createPdfBuffer(data: QuoteDataForPdf, language: 'es' | 'en'): Promise<Buffer> {
  const logo = await sharp(OFFICIAL_LOGO).png().toBuffer();
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 50,
      info: {
        Title: `Cotización ${data.quote.quoteNumber || data.quote.id}`,
        Author: 'U-Storage Go',
        Subject: 'Cotización de Mudanza',
        Creator: 'U-Storage Go Platform',
      },
    });

    doc.registerFont('Helvetica', MONTSERRAT_REGULAR);
    doc.registerFont('Helvetica-Bold', MONTSERRAT_SEMIBOLD);
    doc.registerFont('Helvetica-Oblique', MONTSERRAT_REGULAR);

    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const t = translations[language];
    const { quote, inventory, services, addOns, user, moveContext } = data;

    addHeader(doc, quote, t, logo);
    addClientInfo(doc, quote, user, t);
    addLocationInfo(doc, quote, moveContext, t, language);
    addInventorySection(doc, inventory, t);
    addServicesSection(doc, services, addOns, t);
    addPricingSection(doc, quote, t);
    addFooter(doc, t);

    doc.end();
  });
}

const translations = {
  es: {
    quoteTitle: 'COTIZACIÓN DE MUDANZA',
    quoteNumber: 'Número de Cotización',
    date: 'Fecha',
    validUntil: 'Válido hasta',
    clientInfo: 'Información del Cliente',
    name: 'Nombre',
    email: 'Correo Electrónico',
    phone: 'Teléfono',
    origin: 'Origen',
    destination: 'Destino',
    locations: 'Ubicaciones',
    address: 'Dirección',
    floor: 'Piso',
    hasElevator: 'Elevador',
    yes: 'Sí',
    no: 'No',
    inventory: 'Inventario',
    item: 'Artículo',
    category: 'Categoría',
    quantity: 'Cantidad',
    services: 'Servicios',
    addOns: 'Servicios Adicionales',
    service: 'Servicio',
    price: 'Precio',
    pricing: 'Desglose de Precios',
    baseCost: 'Costo Base',
    laborCost: 'Mano de Obra',
    distanceCost: 'Distancia',
    extraHoursCost: 'Horas Extra',
    addOnsCost: 'Servicios Adicionales',
    subtotal: 'Subtotal',
    tax: 'IVA (16%)',
    total: 'Total Estimado',
    estimatedDistance: 'Distancia Estimada',
    estimatedTime: 'Tiempo Estimado',
    homeSize: 'Tamaño del Hogar',
    serviceType: 'Tipo de Servicio',
    direction: 'Dirección del Servicio',
    branch: 'Bodega',
    truckRecommendation: 'Camión Recomendado',
    movers: 'Operarios',
    hours: 'horas',
    km: 'km',
    notAvailable: 'No disponible',
    notes: 'Notas',
    footerText: 'Esta cotización es un estimado y puede variar según las condiciones reales del servicio.',
    termsTitle: 'Términos y Condiciones',
    terms: [
      'Los precios están sujetos a cambios según inventario final.',
      'El tiempo estimado puede variar según condiciones del tráfico.',
      'La confirmación, forma de pago y políticas aplicables se muestran en los detalles del servicio.',
    ],
  },
  en: {
    quoteTitle: 'MOVING QUOTE',
    quoteNumber: 'Quote Number',
    date: 'Date',
    validUntil: 'Valid Until',
    clientInfo: 'Client Information',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    origin: 'Origin',
    destination: 'Destination',
    locations: 'Locations',
    address: 'Address',
    floor: 'Floor',
    hasElevator: 'Elevator',
    yes: 'Yes',
    no: 'No',
    inventory: 'Inventory',
    item: 'Item',
    category: 'Category',
    quantity: 'Quantity',
    services: 'Services',
    addOns: 'Additional Services',
    service: 'Service',
    price: 'Price',
    pricing: 'Pricing Breakdown',
    baseCost: 'Base Cost',
    laborCost: 'Labor',
    distanceCost: 'Distance',
    extraHoursCost: 'Extra Hours',
    addOnsCost: 'Additional Services',
    subtotal: 'Subtotal',
    tax: 'Tax (16%)',
    total: 'Estimated Total',
    estimatedDistance: 'Estimated Distance',
    estimatedTime: 'Estimated Time',
    homeSize: 'Home Size',
    serviceType: 'Service Type',
    direction: 'Service Direction',
    branch: 'Storage Branch',
    truckRecommendation: 'Recommended Truck',
    movers: 'Movers',
    hours: 'hours',
    km: 'km',
    notAvailable: 'Not available',
    notes: 'Notes',
    footerText: 'This quote is an estimate and may vary based on actual service conditions.',
    termsTitle: 'Terms and Conditions',
    terms: [
      'Prices are subject to change based on final inventory.',
      'Estimated time may vary based on traffic conditions.',
      'Confirmation, payment method and applicable policies are shown in the service details.',
    ],
  },
};

type Translations = typeof translations.es;

function addHeader(doc: PDFKit.PDFDocument, quote: Quote, t: Translations, logo: Buffer) {
  doc.rect(0, 0, doc.page.width, 100).fill(BRAND_COLORS.deepOcean);
  doc.image(logo, 50, 22, { fit: [185, 38] });
  
  doc.fillColor(BRAND_COLORS.white)
    .fontSize(12)
    .font('Helvetica')
    .text(t.quoteTitle, 50, 68);

  doc.fillColor(BRAND_COLORS.white)
    .fontSize(10)
    .text(`${t.quoteNumber}: ${quote.quoteNumber || quote.id}`, 400, 35, { align: 'right' });
  
  const dateStr = quote.createdAt ? new Date(quote.createdAt).toLocaleDateString('es-MX') : new Date().toLocaleDateString('es-MX');
  doc.text(`${t.date}: ${dateStr}`, 400, 50, { align: 'right' });
  
  const validDate = new Date();
  validDate.setDate(validDate.getDate() + 30);
  doc.text(`${t.validUntil}: ${validDate.toLocaleDateString('es-MX')}`, 400, 65, { align: 'right' });

  doc.moveDown(3);
}

function addClientInfo(doc: PDFKit.PDFDocument, quote: Quote, user: { fullName?: string | null; email?: string | null; phone?: string | null } | undefined, t: Translations) {
  const startY = 120;
  
  doc.fillColor(BRAND_COLORS.deepOcean)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(t.clientInfo, 50, startY);
  
  doc.moveTo(50, startY + 18).lineTo(250, startY + 18).strokeColor(BRAND_COLORS.horizonTeal).lineWidth(2).stroke();
  
  doc.fillColor(BRAND_COLORS.slateMist)
    .fontSize(10)
    .font('Helvetica');
  
  let y = startY + 30;
  const name = user?.fullName || quote.contactName || t.notAvailable;
  const email = user?.email || quote.contactEmail || t.notAvailable;
  const phone = user?.phone || quote.contactPhone || t.notAvailable;
  
  doc.text(`${t.name}: ${name}`, 50, y);
  y += 15;
  doc.text(`${t.email}: ${email}`, 50, y);
  y += 15;
  doc.text(`${t.phone}: ${phone}`, 50, y);
  
  doc.y = y + 30;
}

function addLocationInfo(doc: PDFKit.PDFDocument, quote: Quote, context: StorageMoveContext, t: Translations, language: 'es' | 'en') {
  const startY = doc.y;
  
  doc.fillColor(BRAND_COLORS.deepOcean)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(t.locations, 50, startY);
  
  doc.moveTo(50, startY + 18).lineTo(250, startY + 18).strokeColor(BRAND_COLORS.horizonTeal).lineWidth(2).stroke();
  
  const colWidth = 250;
  let y = startY + 30;
  
  doc.fillColor(BRAND_COLORS.horizonTeal)
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(t.origin, 50, y)
    .text(t.destination, 50 + colWidth, y);
  
  y += 20;
  doc.fillColor(BRAND_COLORS.slateMist)
    .fontSize(10)
    .font('Helvetica');
  
  const originAddr = quote.fromAddress || t.notAvailable;
  const destAddr = quote.toAddress || t.notAvailable;
  
  doc.text(`${t.address}: ${originAddr}`, 50, y, { width: colWidth - 20 });
  doc.text(`${t.address}: ${destAddr}`, 50 + colWidth, y, { width: colWidth - 20 });
  
  y += 30;
  doc.text(`${t.homeSize}: ${quote.homeSize || '-'}`, 50, y);
  y += 20;
  doc.font('Helvetica-Bold').fillColor(BRAND_COLORS.deepOcean)
    .text(`${t.serviceType}: ${language === 'es' ? context.labels.serviceEs : context.labels.serviceEn}`, 50, y, { width: 512 });
  if (context.isBranchConnected) {
    y += 16;
    doc.font('Helvetica').fillColor(BRAND_COLORS.slateMist)
      .text(`${t.direction}: ${(language === 'es' ? context.labels.directionEs : context.labels.directionEn) || t.notAvailable}`, 50, y);
    if (context.branch) {
      y += 16;
      doc.text(`${t.branch}: ${context.branch.brand} ${context.branch.name}`, 50, y, { width: 512 });
      y += 16;
      doc.text(`${t.address}: ${context.branch.address}`, 50, y, { width: 512 });
      y += 16;
      doc.text(`Google Place ID: ${context.branch.googlePlaceId}`, 50, y, { width: 512 });
    }
  }
  
  doc.y = y + 30;
}

function addInventorySection(doc: PDFKit.PDFDocument, inventory: InventoryItem[], t: Translations) {
  if (inventory.length === 0) return;
  
  if (doc.y > 600) doc.addPage();
  const startY = doc.y;
  
  doc.fillColor(BRAND_COLORS.deepOcean)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(t.inventory, 50, startY);
  
  doc.moveTo(50, startY + 18).lineTo(250, startY + 18).strokeColor(BRAND_COLORS.horizonTeal).lineWidth(2).stroke();
  
  let y = startY + 30;
  
  doc.rect(50, y, 512, 20).fill(BRAND_COLORS.frostBlue);
  doc.fillColor(BRAND_COLORS.deepOcean)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(t.category, 55, y + 5, { width: 150 })
    .text(t.item, 210, y + 5, { width: 200 })
    .text(t.quantity, 440, y + 5, { width: 60 });
  
  y += 25;
  
  // Group inventory by category
  const inventoryByCategory: Record<string, typeof inventory> = {};
  for (const item of inventory) {
    const cat = item.category || 'other';
    if (!inventoryByCategory[cat]) inventoryByCategory[cat] = [];
    inventoryByCategory[cat].push(item);
  }
  
  doc.font('Helvetica').fillColor(BRAND_COLORS.slateMist);
  let rowIndex = 0;
  
  for (const [category, items] of Object.entries(inventoryByCategory)) {
    // Category header
    if (y > 680) {
      doc.addPage();
      y = 50;
    }
    
    doc.font('Helvetica-Bold').fillColor(BRAND_COLORS.deepOcean);
    doc.text(category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' '), 55, y);
    y += 18;
    
    doc.font('Helvetica').fillColor(BRAND_COLORS.slateMist);
    
    for (const item of items) {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      
      if (rowIndex % 2 === 0) {
        doc.rect(50, y - 3, 512, 18).fill(BRAND_COLORS.lightGray);
      }
      
      doc.fillColor(BRAND_COLORS.slateMist)
        .text('', 55, y, { width: 150 }) // Empty for category column since we have headers
        .text(item.itemName, 210, y, { width: 200 })
        .text((item.quantity || 1).toString(), 440, y, { width: 60 });
      
      y += 18;
      rowIndex++;
    }
    
    y += 5; // Space between categories
  }
  
  doc.y = y + 20;
}

function addServicesSection(doc: PDFKit.PDFDocument, services: { name: string; nameEs: string; basePrice: string | null }[], addOns: { name: string; nameEs: string; price: string | null }[], t: Translations) {
  if (services.length === 0 && addOns.length === 0) return;
  
  if (doc.y > 600) doc.addPage();
  const startY = doc.y;
  
  if (services.length > 0) {
    doc.fillColor(BRAND_COLORS.deepOcean)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(t.services, 50, startY);
    
    doc.moveTo(50, startY + 18).lineTo(250, startY + 18).strokeColor(BRAND_COLORS.horizonTeal).lineWidth(2).stroke();
    
    let y = startY + 30;
    doc.font('Helvetica').fontSize(10).fillColor(BRAND_COLORS.slateMist);
    
    for (const svc of services) {
      doc.text(`• ${svc.nameEs || svc.name}`, 55, y);
      y += 15;
    }
    
    doc.y = y + 15;
  }
  
  if (addOns.length > 0) {
    const addOnStartY = doc.y;
    doc.fillColor(BRAND_COLORS.deepOcean)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(t.addOns, 50, addOnStartY);
    
    let y = addOnStartY + 20;
    doc.font('Helvetica').fontSize(10).fillColor(BRAND_COLORS.slateMist);
    
    for (const addon of addOns) {
      const priceStr = addon.price ? `$${parseFloat(addon.price).toLocaleString('es-MX')}` : '';
      doc.text(`• ${addon.nameEs || addon.name} ${priceStr}`, 55, y);
      y += 15;
    }
    
    doc.y = y + 20;
  }
}

function addPricingSection(doc: PDFKit.PDFDocument, quote: Quote, t: Translations) {
  if (doc.y > 550) doc.addPage();
  const startY = doc.y;
  
  doc.fillColor(BRAND_COLORS.deepOcean)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(t.pricing, 50, startY);
  
  doc.moveTo(50, startY + 18).lineTo(250, startY + 18).strokeColor(BRAND_COLORS.horizonTeal).lineWidth(2).stroke();
  
  let y = startY + 35;
  
  const truckRec = (quote as any).truckRecommendation;
  const recMovers = (quote as any).recommendedMovers;
  
  if (truckRec) {
    doc.fillColor(BRAND_COLORS.horizonTeal)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(`${t.truckRecommendation}: ${truckRec}`, 50, y);
    y += 20;
  }
  
  if (recMovers) {
    doc.fillColor(BRAND_COLORS.slateMist)
      .fontSize(10)
      .font('Helvetica')
      .text(`${t.movers}: ${recMovers}`, 50, y);
    y += 15;
  }
  
  y += 10;
  
  doc.rect(320, startY + 30, 230, 120).fill(BRAND_COLORS.lightGray).stroke(BRAND_COLORS.frostBlue);
  
  let priceY = startY + 45;
  doc.fontSize(10).font('Helvetica').fillColor(BRAND_COLORS.slateMist);
  
  const estimate: any = quote.estimatedCost ? (typeof quote.estimatedCost === 'string' ? JSON.parse(quote.estimatedCost) : quote.estimatedCost) : null;
  const breakdown = estimate?.breakdown || {};
  
  const formatPrice = (val: number | string | undefined) => {
    if (val === undefined || val === null) return '-';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
  };
  
  const priceLines: [string, string][] = [];
  if (breakdown.baseCost) priceLines.push([t.baseCost, formatPrice(breakdown.baseCost)]);
  if (breakdown.laborCost) priceLines.push([t.laborCost, formatPrice(breakdown.laborCost)]);
  if (breakdown.distanceCost) priceLines.push([t.distanceCost, formatPrice(breakdown.distanceCost)]);
  if (breakdown.extraHoursCost) priceLines.push([t.extraHoursCost, formatPrice(breakdown.extraHoursCost)]);
  if (breakdown.addOnsCost) priceLines.push([t.addOnsCost, formatPrice(breakdown.addOnsCost)]);
  
  for (const [label, value] of priceLines) {
    doc.text(label, 330, priceY, { width: 120 })
      .text(value, 460, priceY, { width: 80, align: 'right' });
    priceY += 15;
  }
  
  priceY += 5;
  doc.moveTo(330, priceY).lineTo(540, priceY).strokeColor(BRAND_COLORS.slateMist).lineWidth(0.5).stroke();
  priceY += 10;
  
  const total = estimate?.total || quote.finalPrice;
  doc.fontSize(12)
    .font('Helvetica-Bold')
    .fillColor(BRAND_COLORS.deepOcean)
    .text(t.total, 330, priceY, { width: 120 })
    .text(formatPrice(total), 460, priceY, { width: 80, align: 'right' });
  
  doc.y = Math.max(y, priceY + 40);
}

function addFooter(doc: PDFKit.PDFDocument, t: Translations) {
  if (doc.y > 600) doc.addPage();
  let y = doc.y + 20;
  
  doc.fillColor(BRAND_COLORS.deepOcean)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(t.termsTitle, 50, y);
  
  y += 20;
  doc.fontSize(9).font('Helvetica').fillColor(BRAND_COLORS.slateMist);
  
  for (const term of t.terms) {
    doc.text(`• ${term}`, 55, y, { width: 500 });
    y += 15;
  }
  
  y += 20;
  doc.fontSize(10)
    .fillColor(BRAND_COLORS.horizonTeal)
    .font('Helvetica-Oblique')
    .text(t.footerText, 50, y, { align: 'center', width: 512 });
  
  const footerY = doc.page.height - 40;
  doc.rect(0, footerY - 10, doc.page.width, 50).fill(BRAND_COLORS.deepOcean);
  doc.fillColor(BRAND_COLORS.white)
    .fontSize(9)
    .font('Helvetica')
    .text('U-Storage Go', 0, footerY, { align: 'center', width: doc.page.width });
}

export async function saveQuotePdf(quoteId: string, language: 'es' | 'en' = 'es'): Promise<QuoteDocument> {
  const pdfBuffer = await generateQuotePdf(quoteId, language);
  
  const quote = await storage.getQuote(quoteId);
  if (!quote) throw new Error(`Quote not found: ${quoteId}`);
  
  const existingDocs = await storage.getQuoteDocuments(quoteId);
  const version = existingDocs.length > 0 ? Math.max(...existingDocs.map(d => d.version || 1)) + 1 : 1;
  
  const fileName = `Cotizacion_${quote.quoteNumber || quote.id}_v${version}.pdf`;
  const pdfData = pdfBuffer.toString('base64');
  
  const doc = await storage.createQuoteDocument({
    quoteId,
    fileName,
    mimeType: 'application/pdf',
    fileSize: pdfBuffer.length,
    pdfData,
    version,
    generatedAt: new Date(),
  });
  
  return doc;
}

export function getPdfBuffer(base64Data: string): Buffer {
  return Buffer.from(base64Data, 'base64');
}
