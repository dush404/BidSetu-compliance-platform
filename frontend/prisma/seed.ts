// ============================================================
// AI Tender Compliance Platform — Database Seed
// Run with: bun prisma/seed.ts   (after `bun run db:push`)
//
// Data source: the user's ai-worker create_mock_data.py —
// 5 tenders, 8 simulated government registries, and bidders
// covering all 8 compliance scenarios (perfect, GST cancelled,
// blacklisted, Udyam expired, PAN mismatch, suspended, late
// filer, clean non-MSME). All bidders seed as PENDING; live
// verification runs through the Python AI worker on :3010.
//
// Note: GST `lastReturnFiled` is the only rule-relevant date
// (rule_engine._is_date_old, 6-month window), so it is computed
// relative to seed time. All other record dates are the user's
// originals shifted +2 years for a current-looking dataset.
// ============================================================

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DAY_MS = 86_400_000;
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * DAY_MS);
const isoDaysAgo = (d: number) => daysAgo(d).toISOString().slice(0, 10);
/** Shift a YYYY-MM-DD string forward N years (dataset realism). */
const shiftYears = (dateStr: string, n = 2) =>
  dateStr.replace(/^(\d{4})/, (y) => String(Number(y) + n));

// ── Government registries (user's create_mock_data.py, verbatim values) ──

const GST_DATA: {
  gstin: string;
  legalName: string;
  tradeName: string;
  statusId: string;
  /** days before seed-run; negative-intent records are "old" on purpose */
  returnFiledDaysAgo: number;
  textComplianceRating: number;
}[] = [
  // Scenario A — Perfect: Active, recent filing
  { gstin: "27AABCU9603R1Z5", legalName: "TechServe Solutions Pvt Ltd", tradeName: "TechServe Solutions", statusId: "Active", returnFiledDaysAgo: 45, textComplianceRating: 95 },
  // Scenario B — GST Cancelled
  { gstin: "27BBCDU1234R1Z6", legalName: "Infra Build Corp", tradeName: "Infra Build", statusId: "Cancelled", returnFiledDaysAgo: 800, textComplianceRating: 10 },
  // Scenario C — Blacklisted bidder (GST Active; blacklist catches them)
  { gstin: "27QQQQ1234Q1Z9", legalName: "Risky Traders Pvt Ltd", tradeName: "Risky Traders", statusId: "Active", returnFiledDaysAgo: 60, textComplianceRating: 40 },
  // Scenario D — Udyam Expired (GST OK)
  { gstin: "27XYZAB1234C1Z7", legalName: "GreenField Supplies", tradeName: "GreenField", statusId: "Active", returnFiledDaysAgo: 30, textComplianceRating: 80 },
  // Scenario E — PAN Name Mismatch (GST fine)
  { gstin: "27AAACV1234D1Z8", legalName: "Apex Systems Ltd", tradeName: "Apex Systems", statusId: "Active", returnFiledDaysAgo: 45, textComplianceRating: 85 },
  // Scenario F — Multiple discrepancies (GST Suspended)
  { gstin: "27ZZZZ4321Z1Z2", legalName: "Dubious Contractors", tradeName: "Dubious Contractors", statusId: "Suspended", returnFiledDaysAgo: 900, textComplianceRating: 5 },
  // Scenario G — Late GST filer (Active but old filing → REVIEW)
  { gstin: "27MMMM5678M1Z3", legalName: "SlowPay Enterprises", tradeName: "SlowPay", statusId: "Active", returnFiledDaysAgo: 400, textComplianceRating: 50 },
  // Scenario H — Clean non-MSME (no Udyam, not required)
  { gstin: "27PPPP9876P1Z4", legalName: "National Infrastructure Ltd", tradeName: "NatInfra", statusId: "Active", returnFiledDaysAgo: 30, textComplianceRating: 92 },
  // Extra volume bidders
  { gstin: "27AAAA1111A1Z1", legalName: "Sunrise Tech Pvt Ltd", tradeName: "Sunrise Tech", statusId: "Active", returnFiledDaysAgo: 60, textComplianceRating: 88 },
  { gstin: "27BBBB2222B1Z2", legalName: "Coastline Engineering", tradeName: "Coastline Engg", statusId: "Active", returnFiledDaysAgo: 70, textComplianceRating: 78 },
];

const PAN_DATA: { panNumber: string; holderName: string; statusId: string; lastItrFiled: string }[] = [
  { panNumber: "AABCU9603R", holderName: "TechServe Solutions Pvt Ltd", statusId: "Valid", lastItrFiled: "2024-07-31" },
  { panNumber: "BBCDU1234D", holderName: "Infra Build Corp", statusId: "Valid", lastItrFiled: "2022-06-30" },
  { panNumber: "QQQPQ1234Q", holderName: "Risky Traders Pvt Ltd", statusId: "Blacklisted", lastItrFiled: "2023-07-31" },
  { panNumber: "XYZAB1234X", holderName: "GreenField Supplies", statusId: "Valid", lastItrFiled: "2024-07-31" },
  { panNumber: "AAACV1234A", holderName: "WRONGNAME Pvt Ltd", statusId: "Valid", lastItrFiled: "2024-06-30" },
  { panNumber: "ZZZZZ4321Z", holderName: "Dubious Contractors", statusId: "Invalid", lastItrFiled: "2021-07-31" },
  { panNumber: "MMMMP5678M", holderName: "SlowPay Enterprises", statusId: "Valid", lastItrFiled: "2023-07-31" },
  { panNumber: "PPPPP9876P", holderName: "National Infrastructure Ltd", statusId: "Valid", lastItrFiled: "2024-07-31" },
  { panNumber: "AAAAA1111A", holderName: "Sunrise Tech Pvt Ltd", statusId: "Valid", lastItrFiled: "2024-06-30" },
  { panNumber: "BBBBB2222B", holderName: "Coastline Engineering", statusId: "Valid", lastItrFiled: "2024-05-31" },
];

const UDYAM_DATA: { udyamNumber: string; enterpriseName: string; catagory: string; statusId: string; registrationDate: string }[] = [
  { udyamNumber: "UDYAM-MH-01-2024000001", enterpriseName: "TechServe Solutions Pvt Ltd", catagory: "Small", statusId: "Active", registrationDate: "2024-01-15" },
  { udyamNumber: "UDYAM-MH-01-2022000003", enterpriseName: "GreenField Supplies", catagory: "Micro", statusId: "Expired", registrationDate: "2022-05-05" },
  { udyamNumber: "UDYAM-MH-01-2023000002", enterpriseName: "Apex Systems Ltd", catagory: "Small", statusId: "Active", registrationDate: "2023-06-20" },
  { udyamNumber: "UDYAM-MH-01-2024000004", enterpriseName: "Sunrise Tech Pvt Ltd", catagory: "Micro", statusId: "Active", registrationDate: "2024-02-10" },
  { udyamNumber: "UDYAM-MH-01-2024000005", enterpriseName: "SlowPay Enterprises", catagory: "Small", statusId: "Active", registrationDate: "2023-11-01" },
  { udyamNumber: "UDYAM-MH-01-2024000006", enterpriseName: "Risky Traders Pvt Ltd", catagory: "Micro", statusId: "Cancelled", registrationDate: "2023-03-15" },
  { udyamNumber: "UDYAM-MH-01-2024000007", enterpriseName: "Coastline Engineering", catagory: "Small", statusId: "Active", registrationDate: "2024-03-20" },
  { udyamNumber: "UDYAM-DL-01-2024000008", enterpriseName: "SmartBuild Pvt Ltd", catagory: "Medium", statusId: "Active", registrationDate: "2024-01-10" },
];

const EPFO_DATA: { establishmentCode: string; establishmentName: string; status: string; lastComplianceDate: string; employeeCount: number }[] = [
  { establishmentCode: "MHBAN0012345", establishmentName: "TechServe Solutions Pvt Ltd", status: "Compliant", lastComplianceDate: "2024-07-31", employeeCount: 45 },
  { establishmentCode: "MHBAN0023456", establishmentName: "Infra Build Corp", status: "Non-Compliant", lastComplianceDate: "2022-12-31", employeeCount: 120 },
  { establishmentCode: "MHBAN0034567", establishmentName: "GreenField Supplies", status: "Compliant", lastComplianceDate: "2024-06-30", employeeCount: 12 },
  { establishmentCode: "MHBAN0045678", establishmentName: "Apex Systems Ltd", status: "Compliant", lastComplianceDate: "2024-07-31", employeeCount: 67 },
  { establishmentCode: "MHBAN0056789", establishmentName: "SlowPay Enterprises", status: "Compliant", lastComplianceDate: "2024-05-31", employeeCount: 23 },
  { establishmentCode: "MHBAN0067890", establishmentName: "National Infrastructure Ltd", status: "Compliant", lastComplianceDate: "2024-07-31", employeeCount: 850 },
  { establishmentCode: "MHBAN0078901", establishmentName: "Sunrise Tech Pvt Ltd", status: "Compliant", lastComplianceDate: "2024-06-30", employeeCount: 35 },
  { establishmentCode: "MHBAN0089012", establishmentName: "Coastline Engineering", status: "Compliant", lastComplianceDate: "2024-04-30", employeeCount: 28 },
];

const ESIC_DATA: { esicCode: string; establishmentName: string; status: string; lastComplianceDate: string }[] = [
  { esicCode: "ESIC-MH-000001", establishmentName: "TechServe Solutions Pvt Ltd", status: "Compliant", lastComplianceDate: "2024-07-31" },
  { esicCode: "ESIC-MH-000002", establishmentName: "Infra Build Corp", status: "Non-Compliant", lastComplianceDate: "2022-12-31" },
  { esicCode: "ESIC-MH-000003", establishmentName: "GreenField Supplies", status: "Compliant", lastComplianceDate: "2024-06-30" },
  { esicCode: "ESIC-MH-000004", establishmentName: "Apex Systems Ltd", status: "Compliant", lastComplianceDate: "2024-07-31" },
  { esicCode: "ESIC-MH-000005", establishmentName: "SlowPay Enterprises", status: "Compliant", lastComplianceDate: "2024-05-31" },
  { esicCode: "ESIC-MH-000006", establishmentName: "National Infrastructure Ltd", status: "Compliant", lastComplianceDate: "2024-07-31" },
  { esicCode: "ESIC-MH-000007", establishmentName: "Sunrise Tech Pvt Ltd", status: "Compliant", lastComplianceDate: "2024-06-30" },
  { esicCode: "ESIC-MH-000008", establishmentName: "Coastline Engineering", status: "Compliant", lastComplianceDate: "2024-04-30" },
];

const STARTUP_DATA: { dpiitNumber: string; companyName: string; status: string; recognitionDate: string }[] = [
  { dpiitNumber: "DPIIT-2024-TS-001", companyName: "TechServe Solutions Pvt Ltd", status: "Recognized", recognitionDate: "2024-01-20" },
  { dpiitNumber: "DPIIT-2024-ST-002", companyName: "Sunrise Tech Pvt Ltd", status: "Recognized", recognitionDate: "2024-03-15" },
  { dpiitNumber: "DPIIT-2022-RT-003", companyName: "Risky Traders Pvt Ltd", status: "Cancelled", recognitionDate: "2022-06-01" },
];

const NSIC_DATA: { nsicNumber: string; companyName: string; status: string; registrationDate: string; category: string }[] = [
  { nsicNumber: "NSIC-2024-001", companyName: "TechServe Solutions Pvt Ltd", status: "Active", registrationDate: "2024-01-15", category: "Electronics" },
  { nsicNumber: "NSIC-2024-002", companyName: "GreenField Supplies", status: "Expired", registrationDate: "2022-05-10", category: "Agriculture" },
  { nsicNumber: "NSIC-2024-003", companyName: "Coastline Engineering", status: "Active", registrationDate: "2023-11-20", category: "Civil Works" },
];

const BLACKLIST_DATA: { entityName: string; gstin: string; pan: string; reason: string; debarredUntil: string }[] = [
  // Scenario C — Blacklisted bidder
  { entityName: "Risky Traders Pvt Ltd", gstin: "27QQQQ1234Q1Z9", pan: "QQQPQ1234Q", reason: "Fraudulent bidding activity and submission of false documents", debarredUntil: "2027-01-15" },
  { entityName: "Infra Build Corp", gstin: "27BBCDU1234R1Z6", pan: "BBCDU1234D", reason: "Non-performance and repeated violations of procurement norms", debarredUntil: "2026-12-31" },
  { entityName: "Dubious Contractors", gstin: "27ZZZZ4321Z1Z2", pan: "ZZZZZ4321Z", reason: "Misrepresentation of financial capacity and substandard work", debarredUntil: "2028-06-30" },
];

// ── Tenders (user's TENDER_DATA; dates shifted to the current cycle) ──

const TENDER_DATA = [
  {
    code: "TND-2024-001",
    title: "Supply of IT Hardware and Networking Equipment",
    department: "Ministry of Electronics & IT",
    category: "IT",
    status: "OPEN",
    publishedAt: new Date("2026-08-01T10:00:00.000Z"),
    closesAt: new Date("2026-09-15T17:00:00.000Z"),
    value: "₹18 Cr",
  },
  {
    code: "TND-2024-002",
    title: "Civil Construction Works for District Warehouse",
    department: "Ministry of Rural Development",
    category: "Construction",
    status: "OPEN",
    publishedAt: new Date("2026-07-15T10:00:00.000Z"),
    closesAt: new Date("2026-09-30T17:00:00.000Z"),
    value: "₹64 Cr",
  },
  {
    code: "TND-2024-003",
    title: "Supply of Medical Equipment to PHCs",
    department: "Ministry of Health & Family Welfare",
    category: "Health",
    status: "OPEN",
    publishedAt: new Date("2026-08-10T10:00:00.000Z"),
    closesAt: new Date("2026-10-05T17:00:00.000Z"),
    value: "₹27 Cr",
  },
  {
    code: "TND-2024-004",
    title: "IT Infrastructure Upgrade — State Data Centre",
    department: "Dept. of Information Technology",
    category: "IT",
    status: "CLOSED",
    publishedAt: new Date("2026-06-01T10:00:00.000Z"),
    closesAt: new Date("2026-07-31T17:00:00.000Z"),
    value: "₹55 Cr",
  },
  {
    code: "TND-2024-005",
    title: "Solar Power Plant Installation — Government Buildings",
    department: "Ministry of New & Renewable Energy",
    category: "Energy",
    status: "OPEN",
    publishedAt: new Date("2026-08-20T10:00:00.000Z"),
    closesAt: new Date("2026-10-15T17:00:00.000Z"),
    value: "₹96 Cr",
  },
];

// ── Bidder applications (user's seed_bidders, verbatim identities) ──

interface BidderSpec {
  contactName: string;
  company: string;
  gstin: string;
  pan: string;
  udyamId?: string;
  epfoCode?: string;
  esicCode?: string;
  dpiitNumber?: string;
  nsicNumber?: string;
}

const BIDDERS_BY_TENDER: Record<string, BidderSpec[]> = {
  "TND-2024-001": [
    // Scenario A: Perfect bidder
    { contactName: "Rajesh Kumar", company: "TechServe Solutions Pvt Ltd", gstin: "27AABCU9603R1Z5", pan: "AABCU9603R", udyamId: "UDYAM-MH-01-2024000001", epfoCode: "MHBAN0012345", esicCode: "ESIC-MH-000001", dpiitNumber: "DPIIT-2024-TS-001", nsicNumber: "NSIC-2024-001" },
    // Scenario B: GST Cancelled
    { contactName: "Pradeep Singh", company: "Infra Build Corp", gstin: "27BBCDU1234R1Z6", pan: "BBCDU1234D" },
    // Scenario C: Blacklisted
    { contactName: "Mohan Verma", company: "Risky Traders Pvt Ltd", gstin: "27QQQQ1234Q1Z9", pan: "QQQPQ1234Q", udyamId: "UDYAM-MH-01-2024000006" },
    // Scenario D: Udyam expired
    { contactName: "Sunita Rao", company: "GreenField Supplies", gstin: "27XYZAB1234C1Z7", pan: "XYZAB1234X", udyamId: "UDYAM-MH-01-2022000003", epfoCode: "MHBAN0034567", esicCode: "ESIC-MH-000003" },
    // Scenario E: PAN Name Mismatch
    { contactName: "Vikram Mehta", company: "Apex Systems Ltd", gstin: "27AAACV1234D1Z8", pan: "AAACV1234A", udyamId: "UDYAM-MH-01-2023000002", epfoCode: "MHBAN0045678", esicCode: "ESIC-MH-000004" },
    // Scenario F: Multiple discrepancies
    { contactName: "Rahul Sharma", company: "Dubious Contractors", gstin: "27ZZZZ4321Z1Z2", pan: "ZZZZZ4321Z" },
    // Scenario G: Late GST filer
    { contactName: "Anita Patel", company: "SlowPay Enterprises", gstin: "27MMMM5678M1Z3", pan: "MMMMP5678M", udyamId: "UDYAM-MH-01-2024000005", epfoCode: "MHBAN0056789", esicCode: "ESIC-MH-000005" },
    // Scenario H: Clean non-MSME
    { contactName: "Kapil Sharma", company: "National Infrastructure Ltd", gstin: "27PPPP9876P1Z4", pan: "PPPPP9876P", epfoCode: "MHBAN0067890", esicCode: "ESIC-MH-000006" },
  ],
  "TND-2024-002": [
    { contactName: "Deepak Agarwal", company: "Sunrise Tech Pvt Ltd", gstin: "27AAAA1111A1Z1", pan: "AAAAA1111A", udyamId: "UDYAM-MH-01-2024000004", epfoCode: "MHBAN0078901", esicCode: "ESIC-MH-000007", dpiitNumber: "DPIIT-2024-ST-002" },
    { contactName: "Priya Nair", company: "Coastline Engineering", gstin: "27BBBB2222B1Z2", pan: "BBBBB2222B", udyamId: "UDYAM-MH-01-2024000007", epfoCode: "MHBAN0089012", esicCode: "ESIC-MH-000008", nsicNumber: "NSIC-2024-003" },
    { contactName: "Sanjay Gupta", company: "Infra Build Corp", gstin: "27BBCDU1234R1Z6", pan: "BBCDU1234D" },
    { contactName: "Rekha Joshi", company: "GreenField Supplies", gstin: "27XYZAB1234C1Z7", pan: "XYZAB1234X", udyamId: "UDYAM-MH-01-2022000003" },
  ],
  "TND-2024-003": [
    { contactName: "Dr. Mohan Das", company: "TechServe Solutions Pvt Ltd", gstin: "27AABCU9603R1Z5", pan: "AABCU9603R", udyamId: "UDYAM-MH-01-2024000001", epfoCode: "MHBAN0012345", esicCode: "ESIC-MH-000001" },
    { contactName: "Pallavi Menon", company: "Apex Systems Ltd", gstin: "27AAACV1234D1Z8", pan: "AAACV1234A", epfoCode: "MHBAN0045678", esicCode: "ESIC-MH-000004" },
    { contactName: "Ravi Shankar", company: "Risky Traders Pvt Ltd", gstin: "27QQQQ1234Q1Z9", pan: "QQQPQ1234Q" },
    { contactName: "Kavitha Reddy", company: "National Infrastructure Ltd", gstin: "27PPPP9876P1Z4", pan: "PPPPP9876P", epfoCode: "MHBAN0067890", esicCode: "ESIC-MH-000006" },
    { contactName: "Suresh Pillai", company: "Dubious Contractors", gstin: "27ZZZZ4321Z1Z2", pan: "ZZZZZ4321Z" },
    { contactName: "Nisha Kulkarni", company: "SlowPay Enterprises", gstin: "27MMMM5678M1Z3", pan: "MMMMP5678M", udyamId: "UDYAM-MH-01-2024000005" },
    { contactName: "Amit Tripathi", company: "Sunrise Tech Pvt Ltd", gstin: "27AAAA1111A1Z1", pan: "AAAAA1111A", udyamId: "UDYAM-MH-01-2024000004" },
    { contactName: "Geeta Iyer", company: "Coastline Engineering", gstin: "27BBBB2222B1Z2", pan: "BBBBB2222B", udyamId: "UDYAM-MH-01-2024000007" },
  ],
  // User's "TENDER 4 — Solar" block → TND-2024-005 (their comment's intent).
  "TND-2024-005": [
    { contactName: "Arjun Mehta", company: "SolarGrid Energy Pvt Ltd", gstin: "27AABCU9603R1Z5", pan: "AABCU9603R", udyamId: "UDYAM-MH-01-2024000001", epfoCode: "MHBAN0012345", esicCode: "ESIC-MH-000001" },
    { contactName: "Neha Kapoor", company: "SunPeak Renewables", gstin: "27BBCDU1234R1Z6", pan: "BBCDU1234D" },
    { contactName: "Vikram Rao", company: "GreenVolt Systems", gstin: "27QQQQ1234Q1Z9", pan: "QQQPQ1234Q", udyamId: "UDYAM-MH-01-2024000006" },
    { contactName: "Ishita Sen", company: "BrightRay Infrastructure", gstin: "27XYZAB1234C1Z7", pan: "XYZAB1234X", udyamId: "UDYAM-MH-01-2022000003" },
    { contactName: "Rohit Desai", company: "Apex Solar Works", gstin: "27AAACV1234D1Z8", pan: "AAACV1234A", epfoCode: "MHBAN0045678", esicCode: "ESIC-MH-000004" },
    { contactName: "Meera Joshi", company: "EcoRoof Power", gstin: "27PPPP9876P1Z4", pan: "PPPPP9876P", epfoCode: "MHBAN0067890", esicCode: "ESIC-MH-000006" },
    { contactName: "Karan Malhotra", company: "National Solar Services", gstin: "27AAAA1111A1Z1", pan: "AAAAA1111A", udyamId: "UDYAM-MH-01-2024000004" },
    { contactName: "Pooja Nair", company: "CleanEnergy Contractors", gstin: "27BBBB2222B1Z2", pan: "BBBBB2222B", udyamId: "UDYAM-MH-01-2024000007", nsicNumber: "NSIC-2024-003" },
    { contactName: "Aditya Shah", company: "Helio Infrastructure Ltd", gstin: "27MMMM5678M1Z3", pan: "MMMMP5678M", udyamId: "UDYAM-MH-01-2024000005" },
  ],
  // Supplemental: the CLOSED IT-Infrastructure tender reuses real companies
  // (their script already reuses companies across tenders) so no tender is empty.
  "TND-2024-004": [
    { contactName: "Farhan Ali", company: "Infra Build Corp", gstin: "27BBCDU1234R1Z6", pan: "BBCDU1234D" },
    { contactName: "Meera Krishnan", company: "GreenField Supplies", gstin: "27XYZAB1234C1Z7", pan: "XYZAB1234X", udyamId: "UDYAM-MH-01-2022000003" },
    { contactName: "Joseph Thomas", company: "SlowPay Enterprises", gstin: "27MMMM5678M1Z3", pan: "MMMMP5678M", udyamId: "UDYAM-MH-01-2024000005", epfoCode: "MHBAN0056789", esicCode: "ESIC-MH-000005" },
    { contactName: "Divya Saxena", company: "National Infrastructure Ltd", gstin: "27PPPP9876P1Z4", pan: "PPPPP9876P", epfoCode: "MHBAN0067890", esicCode: "ESIC-MH-000006" },
  ],
};

const DOC_SETS: { name: string; type: string; size: string }[][] = [
  [
    { name: "GST-Certificate.pdf", type: "PDF", size: "1.2 MB" },
    { name: "Company-Registration.pdf", type: "PDF", size: "840 KB" },
    { name: "MSME-Udyam-Certificate.pdf", type: "PDF", size: "640 KB" },
  ],
  [
    { name: "GST-Certificate.pdf", type: "PDF", size: "1.2 MB" },
    { name: "PAN-Card.pdf", type: "PDF", size: "210 KB" },
  ],
  [
    { name: "Company-Registration.pdf", type: "PDF", size: "840 KB" },
    { name: "Technical-Proposal.pdf", type: "PDF", size: "3.4 MB" },
    { name: "GST-Certificate.pdf", type: "PDF", size: "1.2 MB" },
  ],
];

async function seedGovRecords() {
  const rows: {
    collection: string;
    filterKey: string;
    filterValue: string;
    data: Record<string, unknown>;
  }[] = [];

  for (const g of GST_DATA) {
    rows.push({
      collection: "gst-databases",
      filterKey: "gstin",
      filterValue: g.gstin,
      data: {
        gstin: g.gstin,
        legalName: g.legalName,
        tradeName: g.tradeName,
        statusId: g.statusId,
        lastReturnFiled: isoDaysAgo(g.returnFiledDaysAgo),
        textComplianceRating: g.textComplianceRating,
      },
    });
  }
  for (const p of PAN_DATA) {
    rows.push({
      collection: "pan-databases",
      filterKey: "panNumber",
      filterValue: p.panNumber,
      data: { ...p, lastItrFiled: shiftYears(p.lastItrFiled) },
    });
  }
  for (const u of UDYAM_DATA) {
    rows.push({
      collection: "udyam-databases",
      filterKey: "udyamNumber",
      filterValue: u.udyamNumber,
      data: { ...u, registrationDate: shiftYears(u.registrationDate) },
    });
  }
  for (const e of EPFO_DATA) {
    rows.push({
      collection: "epfo-databases",
      filterKey: "establishmentCode",
      filterValue: e.establishmentCode,
      data: { ...e, lastComplianceDate: shiftYears(e.lastComplianceDate) },
    });
  }
  for (const e of ESIC_DATA) {
    rows.push({
      collection: "esic-databases",
      filterKey: "esicCode",
      filterValue: e.esicCode,
      data: { ...e, lastComplianceDate: shiftYears(e.lastComplianceDate) },
    });
  }
  for (const s of STARTUP_DATA) {
    rows.push({
      collection: "startup-india-databases",
      filterKey: "dpiitNumber",
      filterValue: s.dpiitNumber,
      data: { ...s, recognitionDate: shiftYears(s.recognitionDate) },
    });
  }
  for (const n of NSIC_DATA) {
    rows.push({
      collection: "nsic-databases",
      filterKey: "nsicNumber",
      filterValue: n.nsicNumber,
      data: { ...n, registrationDate: shiftYears(n.registrationDate) },
    });
  }
  for (const b of BLACKLIST_DATA) {
    rows.push({
      collection: "blacklist-databases",
      filterKey: "entityName",
      filterValue: b.entityName,
      data: b,
    });
  }

  await db.govRecord.createMany({ data: rows });
  return rows.length;
}

async function main() {
  console.log("Seeding AI Tender Compliance Platform (user mock data) …");

  // wipe existing rows (children first)
  await db.auditEntry.deleteMany();
  await db.bidderDocument.deleteMany();
  await db.complianceCheck.deleteMany();
  await db.bidder.deleteMany();
  await db.tender.deleteMany();
  await db.govRecord.deleteMany();

  const govCount = await seedGovRecords();
  console.log(`  gov registries seeded: ${govCount} records across 8 collections`);

  let docSetIndex = 0;
  for (const t of TENDER_DATA) {
    const tender = await db.tender.create({ data: t });
    const specs = BIDDERS_BY_TENDER[t.code] ?? [];

    for (const spec of specs) {
      const docSet = DOC_SETS[docSetIndex++ % DOC_SETS.length];
      await db.bidder.create({
        data: {
          tenderId: tender.id,
          contactName: spec.contactName,
          company: spec.company,
          gstin: spec.gstin,
          pan: spec.pan,
          udyamId: spec.udyamId,
          epfoCode: spec.epfoCode,
          esicCode: spec.esicCode,
          dpiitNumber: spec.dpiitNumber,
          nsicNumber: spec.nsicNumber,
          status: "PENDING",
          documents: {
            create: docSet.map((d, i) => ({
              name: d.name,
              type: d.type,
              size: d.size,
              uploadedAt: daysAgo(3 + ((docSetIndex * 2 + i * 5) % 18)),
            })),
          },
        },
      });
    }
    console.log(`  ${t.code} · ${specs.length} bidders`);
  }

  // Recent session entry — verification audits are produced live by the
  // AI worker through the Strapi-compatible adapter.
  await db.auditEntry.create({
    data: {
      action: "SESSION",
      message: "Officer signed in",
      officer: "Procurement Officer",
      createdAt: new Date(now - 2 * 60_000),
    },
  });

  const [tenders, bidders, checks, documents, audits, gov] = await Promise.all([
    db.tender.count(),
    db.bidder.count(),
    db.complianceCheck.count(),
    db.bidderDocument.count(),
    db.auditEntry.count(),
    db.govRecord.count(),
  ]);
  console.log({ tenders, bidders, checks, documents, audits, gov });
  console.log("Seed complete. Run a few verifications in the UI to populate dashboards.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
