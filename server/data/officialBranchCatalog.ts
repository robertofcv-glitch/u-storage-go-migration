import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const OFFICIAL_BRANCH_CATALOG_VERSION = "2026-08-24";
export const OFFICIAL_BRANCH_SOURCE_SHA256 = "f7b65eeb090431e96d6971a96955b350ab73c940c3d3b87c4c532a5bfcd78592";
export const OFFICIAL_BRANCH_SOURCE_PATH =
  "attached_assets/260824_Base_de_sucursales_completa_info_LIGAS_CORREGIDAS_(1)_1789836667027.xlsx";

export interface OfficialBranchRecord {
  externalId: string;
  brand: string;
  name: string;
  region: string;
  url: string;
  mapsUrl: string;
  address: string;
  lat: string;
  lng: string;
  googlePlaceId: string;
  verificationNote: string;
}

const LEGACY_EXTERNAL_IDS: Record<string, string> = {
  "acapulco": "24",
  "anzures polanco": "32",
  "av del iman": "29",
  "anil granjas mexico": "43",
  "calzada del hueso anahuac": "53",
  "churubusco": "27",
  "circuito": "23",
  "condesa": "37",
  "cuajimalpa santa fe": "10",
  "del valle": "22",
  "gustavo baz": "3",
  "insurgentes sur guadalupe inn": "40",
  "interlomas": "33",
  "lerma": "4",
  "lerma outlet": "42",
  "lindavista": "25",
  "mariano escobedo": "38",
  "mexico tacuba": "7",
  "narvarte": "35",
  "parques polanco": "28",
  "paseo interlomas": "34",
  "periferico pedregal": "55",
  "periferico san antonio": "21",
  "periferico toreo": "20",
  "polanco": "1",
  "prolongacion san antonio": "6",
  "puebla": "16",
  "queretaro": "15",
  "reforma hamburgo": "54",
  "revolucion": "30",
  "rio san joaquin granada": "39",
  "roma": "11",
  "santa fe": "8",
  "santa fe vasco de quiroga": "12",
  "tepeyac": "31",
  "tlalpan 949": "2",
  "tlalpan coapa": "13",
  "universidad": "19",
  "viaducto": "9",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function regionFor(address: string): string {
  const normalized = normalize(address);
  if (normalized.includes("cdmx")) return "CDMX";
  if (normalized.includes("edo mex") || normalized.includes("estado de mexico")) return "Estado de México";
  if (normalized.includes("acapulco") || normalized.includes("guerrero")) return "Guerrero";
  if (normalized.includes("puebla")) return "Puebla";
  if (normalized.includes("queretaro")) return "Querétaro";
  if (normalized.includes("zapopan") || normalized.includes("tlaquepaque") || normalized.includes("jalisco")) return "Jalisco";
  if (normalized.includes("san luis potosi")) return "San Luis Potosí";
  if (normalized.includes("leon") || normalized.includes("guanajuato")) return "Guanajuato";
  return "México";
}

export async function loadOfficialBranchCatalog(): Promise<OfficialBranchRecord[]> {
  const sourcePath = resolve(process.cwd(), OFFICIAL_BRANCH_SOURCE_PATH);
  const source = await readFile(sourcePath);
  const sha256 = createHash("sha256").update(source).digest("hex");
  if (sha256 !== OFFICIAL_BRANCH_SOURCE_SHA256) {
    throw new Error(`Official branch workbook checksum mismatch: expected ${OFFICIAL_BRANCH_SOURCE_SHA256}, received ${sha256}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(source as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("Official branch workbook does not contain a worksheet");

  const catalog: OfficialBranchRecord[] = [];
  for (let rowNumber = 3; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    if (!row.getCell(2).value) continue;
    const brand = row.getCell(3).text.trim();
    const name = row.getCell(4).text.trim();
    if (!brand || !name) continue;
    const url = row.getCell(5).text.trim().replace(/\/$/, "");
    const mapsUrl = row.getCell(6).text.trim();
    const address = row.getCell(13).text.trim();
    const lat = row.getCell(14).text.trim();
    const lng = row.getCell(15).text.trim();
    const googlePlaceId = row.getCell(16).text.trim();
    const verificationNote = row.getCell(17).text.trim();
    const legacyId = LEGACY_EXTERNAL_IDS[normalize(name)];
    catalog.push({
      externalId: legacyId ?? `official:${googlePlaceId}`,
      brand,
      name,
      region: regionFor(address),
      url,
      mapsUrl,
      address,
      lat,
      lng,
      googlePlaceId,
      verificationNote,
    });
  }

  if (catalog.length !== 49) throw new Error(`Official branch catalog must contain 49 branches; found ${catalog.length}`);
  if (new Set(catalog.map((branch) => branch.googlePlaceId)).size !== catalog.length) {
    throw new Error("Official branch catalog contains duplicate Google Place IDs");
  }
  if (catalog.some((branch) => !branch.googlePlaceId || !branch.address || !branch.lat || !branch.lng || !branch.mapsUrl)) {
    throw new Error("Official branch catalog contains incomplete geographic records");
  }
  return catalog;
}