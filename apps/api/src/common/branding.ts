// Demo mode swaps Charlie's real billing identity for a fictional persona so the
// app can be screen-recorded for people other than Charlie without exposing his
// real legal name or contact details. Toggled with DEMO_MODE=true (off in normal
// operation). Identity-only: the dataset itself is already mock seed data.
const DEMO = process.env.DEMO_MODE === 'true';

export interface Sender {
  legalName: string;
  // Name-less contact stack (address, email, phone) — the legal name is the
  // big header rendered above it.
  contact: string[];
}

// Charlie's real billing identity, matching the invoices he sends from
// QuickBooks. Hardcoded by decision (one-person LLC; changes ~once a decade).
const REAL: Sender = {
  legalName: 'Charlie Foltz Media LLC',
  contact: [
    '294 Starling Way',
    'Hendersonville, NC 28792',
    'production@charliefoltz.com',
    '+1 (707) 972-1873',
  ],
};

// Fictional stand-in. example/555-01xx values are reserved-for-fiction so they
// can never collide with a real company, address, or phone line.
const DEMO_SENDER: Sender = {
  legalName: 'Riverstone Media LLC',
  contact: [
    '100 Demo Street',
    'Austin, TX 78701',
    'production@riverstonemedia.com',
    '+1 (555) 010-0100',
  ],
};

/** Sender identity for invoice/report/track PDFs — demo-aware. */
export const SENDER: Sender = DEMO ? DEMO_SENDER : REAL;

/** Company name for PDF headers that show only the legal name (no contact). */
export const COMPANY_NAME = SENDER.legalName;
