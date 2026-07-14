import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { asc, like, sql } from 'drizzle-orm';
import {
  demoInvoiceDescription,
  HoldPeriodSchema,
  type IsoDate,
} from '@workspace/shared';

// @workspace/shared resolves to its BUILT dist at runtime while types come from
// src — a stale dist typechecks green but silently misbehaves (this corrupted
// the first prod license import; see repair-license-import.ts).
if (!(HoldPeriodSchema.options as readonly string[]).includes('none'))
  throw new Error(
    'stale @workspace/shared build — run `pnpm --filter @workspace/shared build` first',
  );
import { InvoiceIssuerService } from '../invoices/invoice-issuer.service';
import { db } from '../common/database/db';
import {
  brand,
  brandCategory,
  demo,
  invoice,
  payer,
  user,
} from '../common/database/schema';

/**
 * Demo import — the one-off 2020–2026 QuickBooks "Demo" product-group backfill
 * (ADR-0011, CONTEXT.md "Demo import"). Reverses the Demo entity's original
 * forward-only scoping: every source row mints one open, hold-none Demo plus
 * its auto-issued Invoice born Paid on the transaction date.
 *
 *   pnpm import:demos -- <source.csv> [--completions <needs-review.csv>] [--out <dir>]
 *
 * Sibling of import-wfh.ts minus the track machinery — Demos reference no
 * Track, so the matcher, the never-creates-tracks rule, and the track_name
 * completion column all drop out. The Brand (absent from the source, which
 * names only the paying music house) is curated per row below; the two rows
 * whose brand can't be named confidently round-trip through needs-review with
 * a brand_name column. Idempotency (`[import:<key>]` notes token), gapless
 * renumbering, one transaction, and no reminder rules all follow the family.
 * 364 rows, $118,141.37 — Σ imported fees must reconcile to the penny.
 */

// ── CSV (RFC 4180: quoted fields, embedded newlines/commas, "" escapes) ─────

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvLine(fields: string[]): string {
  return fields.map((f) => `"${f.replaceAll('"', '""')}"`).join(',');
}

// ── Source row shape ─────────────────────────────────────────────────────────

const COL = {
  date: 1,
  type: 2,
  num: 3,
  customer: 4,
  description: 5,
  amount: 8,
} as const;

interface SourceRow {
  key: string;
  index: number;
  isoDate: IsoDate;
  num: string;
  payerName: string;
  description: string;
  amount: string; // normalized "1234.56"
  brandName: string | null; // curated; null → Charlie supplies via brand_name
}

// ── Payer aliases (grilled 2026-07-14) ──────────────────────────────────────
// "Interval Media LLC" (3 rows, all 2024-08-09) is the same music house as
// "Interval" (19 rows, 2024–2026) renamed in QuickBooks. Payers have no merge
// feature, so a wrong split would be permanent — merged at import time under
// the current name.

const PAYER_ALIASES: Record<string, string> = {
  'interval media llc': 'Interval',
};

// ── Per-row brand curation (grilled 2026-07-14) ─────────────────────────────
// The source names only the paying music house; the Brand is curated here for
// every row, keyed by `<QB num>|<description>` (verbatim, trimmed — several
// keys carry embedded U+FEFF from QuickBooks). null → the row round-trips
// through needs-review and Charlie fills the brand_name column.
//
// Curation policy: the description is usually the brand name; noise (Demo,
// Round N, Job #, payment scribbles) is dropped. Spellings align with brands
// the license import already created ("On Star", "Door Dash", "Freeform TV",
// "Coors", "Capital One" for the "Capitol One" typo); flagrant misspellings of
// well-known brands are corrected (Nutrogena → Neutrogena, Tilamook →
// Tillamook, Principle → Principal Financial, Cliff → Clif Bar, Gentlemen →
// Gentleman Jack, Sun Sweet → Sunsweet, WeGovy → Wegovy); same-file variants
// are normalized (VisitCa/VisitCA, Fan Duel/FanDuel). Three rows infer the
// brand from their QB invoice siblings, the WFH "Additional Edits" precedent:
// 1093|Vocalist Demo → Bath and Body Works, 1587|Additional Edits → Lincoln,
// 1591|Vocal Demo → Kraft. The raw description survives as the working name.

const CURATED: Record<string, string | null> = {
  '1001|Starbucks': 'Starbucks',
  '1002|Hilton': 'Hilton',
  '1006|HPE': 'HPE',
  '1006|Miller Decisions': 'Miller Decisions',
  '1006|Visionworks': 'Visionworks',
  '1006|Olay': 'Olay',
  '1006|UHC': 'UHC',
  '1006|Alka Seltzer': 'Alka Seltzer',
  '1006|Army': 'Army',
  '1006|Jack In The Box - I Feel Pretty': 'Jack In The Box',
  '1007|Yessian Demos': null,
  '1009|Waze Demo': 'Waze',
  '1010|HGTV Demo (Paid 12/17)': 'HGTV',
  '1010|Dupixent Demo (2 rounds)': 'Dupixent',
  '1010|Remax Demo Paid 12/17)': 'Remax',
  '1011|Miller Lite Demo (Round2) Job #2282': 'Miller Lite',
  '1013|Always Demo': 'Always',
  '1014|Mercari Demo (Paid 1.6)': 'Mercari',
  '1014|Cricket Wireless Demo (Paid 1.6)': 'Cricket Wireless',
  '1014|Weight Watchers': 'Weight Watchers',
  '1014|Doritos': 'Doritos',
  '1015|Nike': 'Nike',
  '1017|Golden Road Demo (Job #2407)': 'Golden Road',
  '1017|Mrs Meyers Demo (Job #: 2412)': 'Mrs Meyers',
  '1017|Golden Road Demo Rework (Job #2407)': 'Golden Road',
  '1018|Olly Demo': 'Olly',
  '1023|Expedia': 'Expedia',
  '1024|Headspace Demo': 'Headspace',
  '1025|Xifaxan Demo': 'Xifaxan',
  '1025|VisitCA': 'VisitCA',
  '1025|Zales': 'Zales',
  '1033|USAA demo': 'USAA',
  '1049|Rinvoq Demo': 'Rinvoq',
  '1034|Dupixent Round 2': 'Dupixent',
  '1034|Galderma (Paid 4.12)': 'Galderma',
  '1034|Coke (Paid 4.12)': 'Coke',
  '1035|Mentos - Sled (Job 2436)': 'Mentos',
  '1035|Mentos - River (Job 2436)': 'Mentos',
  '1038|Starbucks (Job 2445)': 'Starbucks',
  '1036|Jim Beam Alive': 'Jim Beam',
  '1037|Taco Bell - Eat Like You': 'Taco Bell',
  '1043|Kingsford Demo': 'Kingsford',
  '1044|Lincoln Spring Sales (Paid 3.12)': 'Lincoln',
  '1044|Lincoln Spring Sales Round 2 (Paid 3.12)': 'Lincoln',
  '1044|Cadillac (Paid 3.25)': 'Cadillac',
  '1044|Green Mountain Energy (Paid 3.25)': 'Green Mountain Energy',
  '1045|ESPN (Job 2466)': 'ESPN',
  '1047|Dicks Inside Moves': 'Dicks',
  '1047|Best Buy (paid 4.25)': 'Best Buy',
  '1047|Cox (paid 4.25)': 'Cox',
  '1047|Zales (paid 4.25)': 'Zales',
  '1047|Green Mountain Energy // Round 2 (paid 4.25)': 'Green Mountain Energy',
  '1047|Paragard (paid 4.25)': 'Paragard',
  '1047|Cadillac (paid 4.25)': 'Cadillac',
  '1052|Microsoft // NBA': 'Microsoft',
  '1053|Chipotle': 'Chipotle',
  '1058|Best Buy // Shadow': 'Best Buy',
  '1061|ESPN NFL Demo (Job 2492)': 'ESPN',
  '1061|ESPN NFL Demo // Round 2 (Job 2492)': 'ESPN',
  '1062|Olay': 'Olay',
  '1063|Rice A Roni': 'Rice A Roni',
  '1065|Jack In The Box // Jason Derulo (Job 2500)': 'Jack In The Box',
  '1069|Gentlemen Jack': 'Gentleman Jack',
  '1069|Pepsi Mnemonic': 'Pepsi',
  '1069|CVS': 'CVS',
  '1073|GE Demo': 'GE',
  '1076|Mattress Firm (Paid 8.9.21)': 'Mattress Firm',
  '1076|Otezla': 'Otezla',
  '1077|Braun // Job #2540': 'Braun',
  '1080|Petco': 'Petco',
  '1079|Olympics // Job #: 2496': 'Olympics',
  '1081|Chase': 'Chase',
  '1081|Chase Round 2': 'Chase',
  '1082|Kaiser Permanente': 'Kaiser Permanente',
  '1084|Job #: 210712a_Citibank Demo': 'Citibank',
  '1086|Google': 'Google',
  '1086|Ingrezza (Paid 8.9.21)': 'Ingrezza',
  '1086|Pfizer (Paid 9.22)': 'Pfizer',
  '1086|Fluzone (Paid 9.22)': 'Fluzone',
  '1087|Paralympics': 'Paralympics',
  '1088|Chevy (Paid)': 'Chevy',
  '1089|Olay (Paid 10.15)': 'Olay',
  '1089|Lincoln (Paid 9.22)': 'Lincoln',
  '1089|VisitCa (Paid 11.24)': 'VisitCA',
  '1089|Hersheys // Kiss Me (Paid 10.15)': 'Hersheys',
  '1089|Hersheys // I Only Want To Be With You (Paid 10.15)': 'Hersheys',
  '1090|Comcast Demo': 'Comcast',
  '1094|Tik Tok // Dr Pepper Job #: \ufeff2597': 'Dr Pepper',
  '1095|Kyndryl Demo + Revisions': 'Kyndryl',
  '1093|Bath and Body Works Job #2593': 'Bath and Body Works',
  '1093|Vocalist Demo': 'Bath and Body Works',
  '1101|Job #: \ufeff2607 A&F x Tik Tok': 'A&F',
  '1096|Penn State // Power of Penn State': 'Penn State',
  '1096|Penn State // The New Legacy': 'Penn State',
  '1097|Intel': 'Intel',
  '1097|Cadillac Holiday': 'Cadillac',
  '1098|Hyundai - Plug': 'Hyundai',
  '1098|Hyundai - Gas Card': 'Hyundai',
  '1098|Hyundai - Squeegee': 'Hyundai',
  '1102|Ross Holiday': 'Ross',
  '1108|7-Eleven': '7-Eleven',
  '1109|Alight Demo': 'Alight',
  '1111|Sprite': 'Sprite',
  '1111|Sprite Round 2': 'Sprite',
  '1115|Starburst // Job # 2619': 'Starburst',
  '1116|Accenture': 'Accenture',
  '1117|Listerine': 'Listerine',
  '1118|Listerine Edits': 'Listerine',
  '1119|Job #: 210929a_Hydrow': 'Hydrow',
  '1121|San Diego Tourism': 'San Diego Tourism',
  '1121|JBL Giannis': 'JBL',
  '1121|Calia': 'Calia',
  '1123|Rinvoq (Job #: \ufeff2533\ufeff)': 'Rinvoq',
  '1126|AMD': 'AMD',
  '1133|Samsung': 'Samsung',
  '1129|Fidelity Retirement // Job #: 211111a': 'Fidelity',
  '1130|Holiday Inn': 'Holiday Inn',
  '1131|Carvana': 'Carvana',
  '1132|Ford': 'Ford',
  '1169|Starbucks Job# 2667': 'Starbucks',
  '1135|AMD Conform': 'AMD',
  '1136|NBC': 'NBC',
  '1136|Calia Round 2': 'Calia',
  '1136|Vuity': 'Vuity',
  '1137|IT Cosmetics Nude Glow // Job #2664': 'IT Cosmetics',
  '1140|Treefort Sonic ID': 'Treefort',
  '1141|RingCentral': 'RingCentral',
  '1142|Nike // Witness Me': 'Nike',
  '1143|GM Powered Solutions': 'GM',
  "1144|Casey's Job #: \ufeff2674\ufeff (v1-4 + Revs)": "Casey's",
  "1144|Casey's Round 2 Job #: \ufeff2674\ufeff (v5-8 + Revs)": "Casey's",
  "1144|Casey's Round 3 Job #: \ufeff2674\ufeff (v9-11 + Revs + Pop Alts)":
    "Casey's",
  '1146|Calia Round 4': 'Calia',
  '1150|Beautyrest': 'Beautyrest',
  '1151|Ford Round 2': 'Ford',
  '1152|Orkin Pros #2680': 'Orkin',
  '1153|Twirla': 'Twirla',
  '1156|JBL': 'JBL',
  '1157|NBC ASC Additional': 'NBC',
  '1165|GMC_OCS_csfv1-3a': 'GMC',
  '1166|Toyota - ABC Job #: \ufeff2702': 'Toyota',
  '1168|Dyson (Job #: \ufeff2704\ufeff)': 'Dyson',
  '1171|CT Tourism': 'CT Tourism',
  '1172|LegalZoom': 'LegalZoom',
  '1175|Duracell': 'Duracell',
  '1174|Mazda (v1+v2)': 'Mazda',
  '1178|IT Cosmetics Job #: \ufeff2710': 'IT Cosmetics',
  '1179|Freeform Job #: \ufeff2699': 'Freeform TV',
  '1180|Juvederm': 'Juvederm',
  '1188|AFLAC Demo': 'AFLAC',
  '1210|Ford BRONCO': 'Ford',
  '1192|Aleve': 'Aleve',
  '1193|Lincoln': 'Lincoln',
  '1194|Opendoor Rounds 2-3': 'Opendoor',
  '1196|BetMGM': 'BetMGM',
  '1196|BetMGM edits': 'BetMGM',
  '1197|Klarna': 'Klarna',
  '1198|Freeform Round 2': 'Freeform TV',
  '1199|Aveeno': 'Aveeno',
  '1209|Squarespace': 'Squarespace',
  '1202|Toyota - Meet The Family Job #2751': 'Toyota',
  '1203|Toyota - Wild Season Job #2751': 'Toyota',
  '1204|Toyota - Wild Attitude Job #2751': 'Toyota',
  '1204|Toyota - Wild Attitude Round 2 Job #2751': 'Toyota',
  '1205|ESPN': 'ESPN',
  '1207|EVO': 'EVO',
  '1206|Priority Health Job #2760': 'Priority Health',
  '1213|Xifaxan Refresh Demo': 'Xifaxan',
  '1211|Circle Rounds 1+2': 'Circle',
  '1212|Sutter Health // “Never Ending” #3088': 'Sutter Health',
  '1216|NHL': 'NHL',
  '1227|Cadillac OCS - 2 demos': 'Cadillac',
  '1228|Naturemade Job #2788': 'Naturemade',
  '1221|Binance QD220902': 'Binance',
  '1222|Ross': 'Ross',
  '1223|Toyota 300D': 'Toyota',
  '1224|Clairol': 'Clairol',
  '1239|Zillow': 'Zillow',
  '1237|Universal Studios': 'Universal Studios',
  '1248|Universal Studios - Additional Demo': 'Universal Studios',
  '1246|CG Insurance': 'CG',
  '1252|Disney': 'Disney',
  '1253|Huntington ID Job#: 2848': 'Huntington Bank',
  '1254|Frooti': 'Frooti',
  '1255|Mercedes QD230201': 'Mercedes',
  '1256|Google': 'Google',
  '1262|Cottonelle - Job #: \ufeff2837': 'Cottonelle',
  '1263|Subway': 'Subway',
  '1264|Huntington Bank - Job #: \ufeff2848': 'Huntington Bank',
  '1265|NYT - Sneakers (2 Rounds) QD230300': 'NYT',
  '1267|Chevron': 'Chevron',
  '1268|Essentia': 'Essentia',
  '1271|Google Countdown Spot #1': 'Google',
  '1272|Google Countdown Spot #2': 'Google',
  '1275|Zillow': 'Zillow',
  '1277|Subway': 'Subway',
  '1278|On Star': 'On Star',
  '1285|Ross': 'Ross',
  '1287|Motrin': 'Motrin',
  '1289|Lincoln Spring 2023 - 2 rounds': 'Lincoln',
  '1283|Target': 'Target',
  '1291|Overwatch': 'Overwatch',
  '1292|MAX Tag': 'Max',
  '1280|On Star Round 2 demo': 'On Star',
  '1293|Old Navy - Sketchy Edits': 'Old Navy',
  '1293|Old Navy - Pixie Original + Library Edits': 'Old Navy',
  '1293|Old Navy - Taylor Original + Library Edits': 'Old Navy',
  '1294|Olive Garden': 'Olive Garden',
  '1296|TopGolf': 'TopGolf',
  '1299|Chase (US-2974)': 'Chase',
  '1300|NFL': 'NFL',
  '1301|LP(a)': 'LP(a)',
  '1302|On Star (Spot 2)': 'On Star',
  '1303|Lexus': 'Lexus',
  '1305|Venus': 'Venus',
  '1310|Lexus R2': 'Lexus',
  '1312|Venus R3': 'Venus',
  '1313|Allstate Mnemonic': 'Allstate',
  '1314|Squarespace': 'Squarespace',
  '1315|ESPN': 'ESPN',
  '1318|American Airlines': 'American Airlines',
  '1322|Nutrogena': 'Neutrogena',
  '1323|Lexus R3': 'Lexus',
  '1324|OnStar - In Your Driveway R1 (NEWNEW Extra)': 'On Star',
  '1325|OnStar - In Your Driveway R2': 'On Star',
  '1326|Air Company': 'Air Company',
  '1327|Cadillac - Holiday': 'Cadillac',
  '1328|Ariat': 'Ariat',
  '1329|Bing Ai': 'Bing',
  '1337|Air Company Extra': 'Air Company',
  '1339|Lexus': 'Lexus',
  '1340|Lubriderm': 'Lubriderm',
  '1341|Capitol One': 'Capital One',
  '1343|Dyson Job #: \ufeff3030': 'Dyson',
  '1344|Tropical Smoothie Cafe': 'Tropical Smoothie Cafe',
  '1346|Buick OCS Demos': 'Buick',
  '1354|Gerber': 'Gerber',
  '1359|Tilamook #3061': 'Tillamook',
  '1360|SOFI NBA': 'SoFi',
  '1361|Zyrtec': 'Zyrtec',
  '1362|Papa Johns R1': 'Papa Johns',
  '1362|Papa Johns R2': 'Papa Johns',
  '1362|Papa Johns R3': 'Papa Johns',
  '1364|USPS': 'USPS',
  '1365|Nissan': 'Nissan',
  '1366|Principal Financial': 'Principal Financial',
  '1367|Dove Divine': 'Dove',
  '1403|AT&T': 'AT&T',
  '1375|Lunchables': 'Lunchables',
  '1376|Zyrtec - v2a': 'Zyrtec',
  '1377|Listerine': 'Listerine',
  '1379|Etsy': 'Etsy',
  '1380|Toyota - Olympics': 'Toyota',
  '1370|Zyrtec Demo': 'Zyrtec',
  '1387|Coors Light - QD240377': 'Coors',
  '1388|USPS': 'USPS',
  '1391|Skrewball  r2': 'Skrewball',
  '1391|Skrewball  r1': 'Skrewball',
  '1393|Cliff Bar Search': 'Clif Bar',
  '1395|Coinbase GAUX': 'Coinbase',
  '1398|Zillow': 'Zillow',
  '1400|Infiniti - QD240236': 'Infiniti',
  '1400|Squarespace Edit - Infiniti': null,
  '1400|Infiniti - QD240236 Round 2': 'Infiniti',
  '1402|Olay': 'Olay',
  '1405|Kleenex #3102': 'Kleenex',
  '1407|Purina': 'Purina',
  '1408|Google Gemini': 'Google Gemini',
  '1409|Pop Tarts': 'Pop Tarts',
  '1409|Pop Tarts R2': 'Pop Tarts',
  '1410|Lincoln': 'Lincoln',
  '1416|UPS - The Guarantee Store + Be Unstoppable': 'UPS',
  '1417|Philadelphia Cream Cheese': 'Philadelphia',
  '1419|Target Tags': 'Target',
  '1419|Target Tags Extension': 'Target',
  '1419|Target Friday Additions': 'Target',
  '1420|Olay - Radio Spot': 'Olay',
  '1421|Michelob': 'Michelob',
  '1422|Rezdiffra': 'Rezdiffra',
  '1427|Aveeno': 'Aveeno',
  '1428|Army_IAAS': 'Army',
  '1431|Nissan': 'Nissan',
  '1432|Michelob 2': 'Michelob',
  '1433|State Street': 'State Street',
  '1434|Rezdiffra ID': 'Rezdiffra',
  '1445|Sun Sweet 1': 'Sunsweet',
  '1445|Sun Sweet 1 - Vocalist': 'Sunsweet',
  '1445|Sun Sweet 2': 'Sunsweet',
  '1446|Meijer Anthem': 'Meijer',
  '1446|Meijer No Power Party': 'Meijer',
  '1446|Meijer Anthem R2': 'Meijer',
  '1446|Meijer No Power Party R2': 'Meijer',
  '1439|TikTok Olympics': 'TikTok',
  '1451|Philo': 'Philo',
  '1455|Amica': 'Amica',
  '1460|AT&T': 'AT&T',
  '1469|Disney': 'Disney',
  '1481|Empire': 'Empire',
  '1483|Lipton (Canopy + Cherry Red)': 'Lipton',
  '1482|Disney': 'Disney',
  '1491|Norton': 'Norton',
  '1486|The Phoenix - TMWGT + singer': 'The Phoenix',
  '1494|Amica': 'Amica',
  '1495|Nordstrom Rack': 'Nordstrom Rack',
  '1498|Google Jungle': 'Google',
  '1503|Google': 'Google',
  '1508|Olay R1': 'Olay',
  '1508|Olay R2': 'Olay',
  '1509|Nordstrom Rack - Round 2': 'Nordstrom Rack',
  '1510|Lexus': 'Lexus',
  '1512|Hubspot': 'Hubspot',
  '1518|Etsy': 'Etsy',
  '1519|Riot Games - Valorant': 'Riot Games',
  '1520|Disney Hong Kong': 'Disney',
  '1524|Apple Final Cut Pro - CRACKPOT': 'Apple',
  '1527|Virginia Lottery': 'Virginia Lottery',
  '1528|Amazon Ads': 'Amazon',
  '1530|Prudential': 'Prudential',
  '1531|Lincoln - R1': 'Lincoln',
  '1531|Lincoln - R2': 'Lincoln',
  '1536|Samsung Edits': 'Samsung',
  '1537|PUMP.FUN': 'PUMP.FUN',
  '1540|Galbani': 'Galbani',
  '1540|Galbani - Vocal Demo': 'Galbani',
  '1541|FanDuel': 'FanDuel',
  '1541|FanDuel 2': 'FanDuel',
  '1542|Dyson - Job #3251': 'Dyson',
  '1549|Rezdiffra R1': 'Rezdiffra',
  '1549|Rezdiffra R2': 'Rezdiffra',
  '1550|Tostitos': 'Tostitos',
  '1555|Nordstrom Rack - Holiday': 'Nordstrom Rack',
  '1556|Fan Duel - Picks': 'FanDuel',
  '1559|Sheraton': 'Sheraton',
  '1560|Coinbase One Card': 'Coinbase',
  '1560|Coinbase - Patty Cake': 'Coinbase',
  '1560|Coinbase - Climb the Ladder': 'Coinbase',
  '1562|Preservision': 'Preservision',
  '1564|Kaiser Permanente Job #: \ufeff3271': 'Kaiser Permanente',
  '1568|Old El Paso': 'Old El Paso',
  '1569|Petsmart': 'Petsmart',
  '1575|WeGovy': 'Wegovy',
  '1576|Dyson N911': 'Dyson',
  '1580|American Airlines': 'American Airlines',
  '1584|iCloud - Job #: \ufeff3288': 'iCloud',
  '1585|Bank of America - Antoine Job #: \ufeff3280': 'Bank of America',
  '1586|Kraft Demo + $200 vocalist': 'Kraft',
  '1588|Sleep Number': 'Sleep Number',
  '1587|Lincoln "The Chef" - Rounds 1+2': 'Lincoln',
  '1587|Additional Edits': 'Lincoln',
  '1591|Kraft - Demo': 'Kraft',
  '1591|Vocal Demo': 'Kraft',
  '1596|Clear Men - Ropeadope': 'Clear Men',
  '1600|Toyota': 'Toyota',
  '1601|IHOP': 'IHOP',
  '1602|DoorDash - Katipulta': 'Door Dash',
  '1603|Sleep Number': 'Sleep Number',
  '1604|Chevy': 'Chevy',
  '1595|Oak Street Health': 'Oak Street Health',
  '1612|Blackstone': 'Blackstone',
  '1621|Bolthouse Farms': 'Bolthouse Farms',
  '1622|Microsoft Job #: \ufeff3347': 'Microsoft',
  '1625|Google': 'Google',
  '1626|Principle Financial': 'Principal Financial',
  '1627|WhatsApp': 'WhatsApp',
};

function parseAmount(raw: string): string {
  const clean = raw.replaceAll(',', '').replaceAll('$', '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(clean))
    throw new Error(`unparseable amount "${raw}"`);
  return Number(clean).toFixed(2);
}

function parseDate(raw: string): IsoDate {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) throw new Error(`unparseable date "${raw}"`);
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

// Stable per-row identity: raw values, not curated ones, so the key never
// shifts under curation changes. Verified collision-free across all 364 rows.
function rowKey(cells: string[]): string {
  const raw = [COL.date, COL.num, COL.customer, COL.description, COL.amount]
    .map((i) => (cells[i] ?? '').trim())
    .join('|');
  return createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

const IMPORT_TAG = /\[import:([0-9a-f]{16})\]/;

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const sourcePath = args.find((a) => !a.startsWith('--'));
  const completionsPath = args.includes('--completions')
    ? args[args.indexOf('--completions') + 1]
    : null;
  const outDir = resolve(
    args.includes('--out')
      ? args[args.indexOf('--out') + 1]
      : 'demo-import-out',
  );
  if (!sourcePath) {
    console.error(
      'Usage: pnpm import:demos -- <source.csv> [--completions <needs-review.csv>] [--out <dir>]',
    );
    process.exit(1);
  }

  // ── Parse + validate the source (fail fast, before any DB write) ──────────
  const rows = parseCsv(readFileSync(resolve(sourcePath), 'utf8'));
  const headerIdx = rows.findIndex((r) => r.includes('Transaction date'));
  if (headerIdx < 0) throw new Error('header row not found (Transaction date)');
  const header = rows[headerIdx];
  for (const [name, idx] of [
    ['Transaction date', COL.date],
    ['Transaction type', COL.type],
    ['Num', COL.num],
    ['Customer full name', COL.customer],
    ['Description', COL.description],
    ['Amount', COL.amount],
  ] as const) {
    if (header[idx]?.trim() !== name)
      throw new Error(
        `column ${idx} is "${header[idx]}", expected "${name}" — sheet layout changed, aborting`,
      );
  }

  const dataCells = rows
    .slice(headerIdx + 1)
    .filter(
      (r) =>
        r.length >= 10 &&
        r[COL.date].trim() !== '' &&
        r[COL.type].trim() === 'Invoice',
    );

  const errors: string[] = [];
  const source: SourceRow[] = [];
  dataCells.forEach((cells, index) => {
    try {
      const description = cells[COL.description].trim();
      const curationKey = `${cells[COL.num].trim()}|${description}`;
      const curated = CURATED[curationKey];
      if (curated === undefined)
        console.warn(
          `WARN row ${headerIdx + 2 + index}: no curation entry for "${curationKey}" — brand goes to needs-review`,
        );
      const rawPayer = cells[COL.customer].trim();
      source.push({
        key: rowKey(cells),
        index,
        isoDate: parseDate(cells[COL.date]),
        num: cells[COL.num].trim(),
        payerName: PAYER_ALIASES[rawPayer.toLowerCase()] ?? rawPayer,
        description,
        amount: parseAmount(cells[COL.amount]),
        brandName: curated ?? null,
      });
    } catch (e) {
      errors.push(
        `row ${headerIdx + 2 + index} (${cells[COL.date]}): ${(e as Error).message}`,
      );
    }
  });
  if (errors.length > 0) {
    console.error(
      `ABORT — ${errors.length} unmappable row(s), nothing imported:`,
    );
    for (const e of errors) console.error('  ' + e);
    process.exit(1);
  }
  const keys = new Set(source.map((r) => r.key));
  if (keys.size !== source.length)
    throw new Error('row-key collision in source — aborting');

  // Curation typo guard: every curated key must exist in the source.
  const sourceKeys = new Set(source.map((r) => `${r.num}|${r.description}`));
  const stale = Object.keys(CURATED).filter((k) => !sourceKeys.has(k));
  if (stale.length > 0)
    throw new Error(
      `curated key(s) not found in source (typo or file changed): ${stale
        .map((k) => `"${k.slice(0, 60)}…"`)
        .join(', ')}`,
    );

  // ── Completions (Charlie's filled needs-review CSV) ────────────────────────
  const brandCompletions = new Map<string, string>();
  if (completionsPath) {
    const crows = parseCsv(readFileSync(resolve(completionsPath), 'utf8'));
    const chead = crows[0].map((h) => h.trim().toLowerCase());
    const kIdx = chead.indexOf('row_key');
    const bIdx = chead.indexOf('brand_name');
    if (kIdx < 0 || bIdx < 0)
      throw new Error('completions CSV needs row_key and brand_name columns');
    for (const r of crows.slice(1)) {
      const k = r[kIdx]?.trim();
      const bname = r[bIdx]?.trim();
      if (k && bname) brandCompletions.set(k, bname);
    }
  }

  // ── Prerequisites: real database, prior-import keys, creator ──────────────
  const payerCount = await db.$count(payer);
  if (payerCount < 10) {
    console.error(
      `ABORT — payer table has only ${payerCount} payers; the license and ` +
        'royalty imports must have run first (is this the real DB?). ' +
        'Nothing imported.',
    );
    process.exit(1);
  }

  const importedKeys = new Set<string>();
  const noteRows = await db
    .select({ notes: demo.notes })
    .from(demo)
    .where(like(demo.notes, '%[import:%'));
  for (const r of noteRows) {
    const m = IMPORT_TAG.exec(r.notes ?? '');
    if (m) importedKeys.add(m[1]);
  }

  const firstUser = await db.query.user.findFirst({
    orderBy: asc(user.createdAt),
  });
  const createdBy = firstUser?.id ?? null;

  // ── Resolve: a row imports only when its brand is named ───────────────────
  type Review = { row: SourceRow; reasons: string[] };
  type Match = { row: SourceRow; brandName: string; via: string };
  const toImport: Match[] = [];
  const review: Review[] = [];
  let skippedAlready = 0;

  for (const row of source) {
    if (importedKeys.has(row.key)) {
      skippedAlready++;
      continue;
    }
    // Charlie's completion beats the curated value.
    const completion = brandCompletions.get(row.key);
    const brandName = completion ?? row.brandName;
    if (brandName)
      toImport.push({
        row,
        brandName,
        via: completion ? 'completion' : 'curated',
      });
    else review.push({ row, reasons: ['brand unknown — fill brand_name'] });
  }

  // ── Import (one transaction; chronological so invoice numbers follow) ─────
  toImport.sort(
    (a, b) =>
      a.row.isoDate.localeCompare(b.row.isoDate) || a.row.index - b.row.index,
  );
  const issuer = new InvoiceIssuerService();
  let createdPayers = 0;
  let createdBrands = 0;

  await db.transaction(async (tx) => {
    const lower = (s: string) => s.toLowerCase();
    const payersByName = new Map(
      (await tx.select().from(payer)).map((p) => [lower(p.name), p.id]),
    );
    const brandsByName = new Map(
      (await tx.select().from(brand)).map((b) => [lower(b.name), b.id]),
    );

    let uncategorizedId: string | null =
      (await tx.select().from(brandCategory)).find(
        (c) => lower(c.name) === 'uncategorized',
      )?.id ?? null;

    for (const m of toImport) {
      const { row } = m;

      let payerId = payersByName.get(lower(row.payerName));
      if (!payerId) {
        // No billing details fabricated — Charlie fills email/address in-app.
        const [p] = await tx
          .insert(payer)
          .values({ name: row.payerName })
          .returning();
        payerId = p.id;
        payersByName.set(lower(row.payerName), payerId);
        createdPayers++;
      }

      let brandId = brandsByName.get(lower(m.brandName));
      if (!brandId) {
        if (!uncategorizedId) {
          const [c] = await tx
            .insert(brandCategory)
            .values({ name: 'Uncategorized' })
            .returning();
          uncategorizedId = c.id;
        }
        const [b] = await tx
          .insert(brand)
          .values({ name: m.brandName, categoryId: uncategorizedId })
          .returning();
        brandId = b.id;
        brandsByName.set(lower(m.brandName), brandId);
        createdBrands++;
      }

      // Working name = the raw description (BOM-stripped) — the historical
      // record, payment scribbles included. The curated Brand carries the
      // clean name.
      const workingName = row.description.replaceAll('﻿', '').trim();
      const notes =
        `Imported from Demo Sales CSV · original invoice #${row.num || '—'}` +
        ` · [import:${row.key}]`;

      // Pre-platform history: hold none (lifted at birth), status open —
      // conversion stays Charlie's decision, never the import's (ADR-0011).
      const [d] = await tx
        .insert(demo)
        .values({
          brandId,
          payerId,
          fee: row.amount,
          workingName,
          holdPeriod: 'none',
          writtenAt: row.isoDate,
          holdEndsAt: row.isoDate,
          notes,
          createdBy,
        })
        .returning();

      // Same gapless allocator as the app (ADR-0001/0002), bypassing the demo
      // service so no app-side rules ever fire for historical rows.
      const inv = await issuer.issue(tx, {
        source: { kind: 'demo', id: d.id },
        billTo: { name: row.payerName, email: null, address: null },
        amount: row.amount,
        description: demoInvoiceDescription({
          brandName: m.brandName,
          workingName,
          terms: null,
        }),
        issueDate: row.isoDate,
        userId: createdBy,
      });
      // Historical invoices are born Paid on their transaction date; Charlie
      // un-marks the few still-open ones in the app.
      await tx
        .update(invoice)
        .set({ paidDate: row.isoDate })
        .where(sql`${invoice.id} = ${inv.id}`);
    }
  });

  // ── Reports ────────────────────────────────────────────────────────────────
  mkdirSync(outDir, { recursive: true });
  const reviewCsv = [
    csvLine([
      'row_key',
      'date',
      'qb_num',
      'payer',
      'amount',
      'reason',
      'description',
      'brand_name',
    ]),
    ...review.map((r) =>
      csvLine([
        r.row.key,
        r.row.isoDate,
        r.row.num,
        r.row.payerName,
        r.row.amount,
        r.reasons.join('; '),
        r.row.description,
        '', // ← Charlie fills this with the brand name
      ]),
    ),
  ].join('\n');
  writeFileSync(resolve(outDir, 'needs-review.csv'), reviewCsv + '\n');

  const auditCsv = [
    csvLine(['row_key', 'date', 'payer', 'brand', 'via', 'fee', 'description']),
    ...toImport.map((m) =>
      csvLine([
        m.row.key,
        m.row.isoDate,
        m.row.payerName,
        m.brandName,
        m.via,
        m.row.amount,
        m.row.description,
      ]),
    ),
  ].join('\n');
  writeFileSync(resolve(outDir, 'match-audit.csv'), auditCsv + '\n');

  const total = toImport
    .reduce((s, m) => s + Number(m.row.amount), 0)
    .toFixed(2);
  console.log(`Source rows:        ${source.length}`);
  console.log(
    `Imported:           ${toImport.length} demos + invoices ($${total})`,
  );
  console.log(
    `  via completion:   ${toImport.filter((m) => m.via === 'completion').length}`,
  );
  console.log(`Skipped (already):  ${skippedAlready}`);
  console.log(
    `Needs review:       ${review.length} → ${resolve(outDir, 'needs-review.csv')}`,
  );
  console.log(
    `New payers:         ${createdPayers} · new brands: ${createdBrands}`,
  );
  console.log(`Match audit:        ${resolve(outDir, 'match-audit.csv')}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('IMPORT FAILED — transaction rolled back, nothing partial:', e);
  process.exit(1);
});
