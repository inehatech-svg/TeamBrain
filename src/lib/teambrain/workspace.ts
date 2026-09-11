/**
 * Simulated Google Drive workspace for the demo firm:
 * Whitfield & Associates LLP — boutique business-law firm, 12 people.
 *
 * This module plays the role of the Google Drive API in the sandbox: a
 * simulated source whose files carry REAL sharing metadata (owner,
 * visibility, sharedWith). The permission engine uses exactly this data,
 * so permission-aware indexing behaves the way it would against the real
 * Drive API with per-user OAuth tokens.
 */

export interface WorkspaceUser {
  email: string;
  name: string;
  role: "ADMIN" | "MEMBER";
  title: string;
  initials: string;
}

export const WORKSPACE_USERS: WorkspaceUser[] = [
  { email: "alice@whitfield.legal", name: "Alice Whitfield", role: "ADMIN", title: "Managing Partner", initials: "AW" },
  { email: "bob@whitfield.legal", name: "Bob Alvarez", role: "MEMBER", title: "Senior Associate", initials: "BA" },
  { email: "carol@whitfield.legal", name: "Carol Nguyen", role: "MEMBER", title: "Paralegal (new hire, week 2)", initials: "CN" },
];

export const WORKSPACE_NAME = "Whitfield & Associates LLP";
export const GOOGLE_ACCOUNT = "alice@whitfield.legal";

export const DRIVE_SCOPES = [
  "drive.readonly — See and download files you already have access to",
  "drive.metadata.readonly — See file & sharing metadata (never content you can't open)",
];

export interface MockDriveFile {
  driveId: string;
  name: string;
  path: string;
  mimeType: string;
  ownerEmail: string;
  visibility: "EVERYONE" | "RESTRICTED";
  sharedWith: string[]; // emails with explicit access (RESTRICTED only)
  modifiedDaysAgo: number;
  content: string;
}

export const MOCK_DRIVE_FILES: MockDriveFile[] = [
  {
    driveId: "drv_policy_expense",
    name: "Expense Reimbursement Policy.pdf",
    path: "/Firm Policies/Expense Reimbursement Policy.pdf",
    mimeType: "application/pdf",
    ownerEmail: "alice@whitfield.legal",
    visibility: "EVERYONE",
    sharedWith: [],
    modifiedDaysAgo: 9,
    content: `## Purpose
This policy defines what the firm reimburses, the spending limits that apply without pre-approval, and how to submit expenses. It applies to all staff and attorneys at Whitfield & Associates.

## Per-Category Limits (no pre-approval needed)
Client meals are reimbursable up to $75 per person including tax and tip, when a client or prospect attends. mileage for client-related travel is reimbursed at 67 cents per mile. Airfare must be economy class unless a partner approves business class for flights over six hours. Individual software subscriptions under $50 per month are reimbursable only if the tool is on the pre-approved tools list maintained by the office manager.

## How to Submit
Submit expenses within 30 days of the purchase date through the finance portal under "New Expense Report". Attach itemized receipts for anything over $25. For mileage, log start and end addresses. Late submissions older than 90 days require managing-partner approval and may be declined.

## Approvals & Payout Timeline
Expenses under $500 are approved by the office manager (Dana Reyes). Anything $500 or above, plus all travel bookings, requires managing-partner approval. Approved expenses are paid out in the next semi-monthly payroll run, on the 15th and the last business day of the month.

## What Is Not Covered
Personal equipment, alcohol beyond the meal cap, parking tickets and traffic fines, first-class upgrades, and expenses missing receipts over $25 are not reimbursable. Client entertainment that is purely social (no business discussion) is limited to $40 per person.`,
  },
  {
    driveId: "drv_policy_remote",
    name: "Remote & Hybrid Work Policy.pdf",
    path: "/Firm Policies/Remote & Hybrid Work Policy.pdf",
    mimeType: "application/pdf",
    ownerEmail: "alice@whitfield.legal",
    visibility: "EVERYONE",
    sharedWith: [],
    modifiedDaysAgo: 21,
    content: `## Hybrid Schedule
Whitfield & Associates operates a hybrid model with two anchor days in the office: Tuesday and Wednesday, 9:30am to 5:00pm. All attorneys and staff are expected on-site those days unless traveling for client work. Outside anchor days you may work from home without approval.

## Desk Booking & Office Space
We use hot-desking on floors 3 and 4. Reserve a desk through the front-desk calendar (outlook resource "W&A Hot Desks") any time before 8:00am the same day. Standing desks near the window row are first-come. Client meetings always get priority for conference rooms — book via the same calendar.

## Home Office Stipend
Every employee is eligible for a $500 home-office stipend once every three years (monitor, chair, keyboard, lighting). Submit through the expense portal with category "Home office equipment". The stipend does not cover furniture assembly or consumables.

## Security Requirements While Remote
Firm laptops must use full-disk encryption and company VPN when off-site. Printing client-confidential documents at home is prohibited — use the secure print release on floor 3. Never take original client files off-site without logging it with the records clerk.

## Core Hours & Availability
Core hours are 10:00am to 4:00pm in your local time zone: be reachable by firm chat and phone. Personal appointments during core hours don't need approval, just update your calendar. Scheduling client calls on your remote days is encouraged.`,
  },
  {
    driveId: "drv_policy_cyber",
    name: "Cybersecurity & Client Data Policy.pdf",
    path: "/Firm Policies/Cybersecurity & Client Data Policy.pdf",
    mimeType: "application/pdf",
    ownerEmail: "alice@whitfield.legal",
    visibility: "EVERYONE",
    sharedWith: [],
    modifiedDaysAgo: 5,
    content: `## Access & Authentication
Multi-factor authentication (MFA) is mandatory on every firm system: email, the practice-management platform, and the document management system. Passwords live in the firm password manager (1Password vault). Sharing credentials over chat or email is prohibited.

## Client Data Handling
Never email client documents to personal email addresses. Client file sharing goes through the firm's secure client portal link, never as email attachments over 5 MB. Downloads of client data to personal devices are prohibited. USB drives and personal cloud storage (Dropbox, personal Google Drive) are banned for any firm or client file.

## Incident Reporting
Report any suspected security incident — phishing, lost device, odd login alert — within 1 hour to the IT helpdesk (it-help@whitfield.legal, extension 411). Do not attempt to investigate on your own. Use the "Report Phishing" button in Outlook rather than deleting suspicious mail, so IT can trace it.

## AI Tool Usage
Client-confidential information may only be entered into AI tools approved by the firm (currently the firm's TeamBrain deployment). Pasting client facts, deal terms, or matter details into public chatbots is a violation of this policy and of our duty of confidentiality.

## Encryption & Devices
All firm laptops must have BitLocker (Windows) or FileVault (macOS) enabled — IT verifies at quarterly check-in. Phones that receive firm email must have a passcode and remote-wipe enrollment. Report lost or stolen devices immediately under Incident Reporting.`,
  },
  {
    driveId: "drv_sop04_review",
    name: "SOP-04 Confidential Document Review.docx",
    path: "/Firm Policies/SOP-04 Confidential Document Review.docx",
    mimeType: "application/vnd.google-apps.document",
    ownerEmail: "alice@whitfield.legal",
    visibility: "EVERYONE",
    sharedWith: [],
    modifiedDaysAgo: 33,
    content: `## Scope
This SOP governs how we review confidential or privileged client documents during discovery and due diligence. It applies to every reviewer, including contract paralegals.

## Two-Pass Review Workflow
Pass one screens for responsiveness to the request. Pass two screens responsive documents for privilege and work product. Reviewers must log both passes in the review platform with a decision code. A document is never marked "fully reviewed" after a single pass.

## Redaction Protocol
Redactions are applied at the "review platform": export level, never by editing the source file. Every redaction must be logged with a reason code (privilege, PII, or attorney work product). Redacted productions get a privilege log entry within 3 business days of production.

## Secure Review Room
Documents marked "restricted" in the DMS may only be reviewed on floor-3 workstations that are air-gapped from guest Wi-Fi. Printing requires supervising-attorney approval and goes to the secure print release. Chain-of-custody log entries are required for every physical transfer.

## Naming Convention
Review files follow MATTER-DOCTYPE-#### (for example M-2024-017-EMAIL-0042). Never rename a source document outside the review platform.`,
  },
  {
    driveId: "drv_play_onboard",
    name: "Client Onboarding Playbook.docx",
    path: "/Firm Playbooks/Client Onboarding Playbook.docx",
    mimeType: "application/vnd.google-apps.document",
    ownerEmail: "alice@whitfield.legal",
    visibility: "EVERYONE",
    sharedWith: [],
    modifiedDaysAgo: 14,
    content: `## Step 1 — Conflicts Check
Run the conflicts check before any substantive discussion: search prior matters, adverse parties, and related entities in the conflicts database. Standard turnaround is 48 hours. If a potential conflict appears, route to the managing partner; do not proceed and do not tell the prospect we found a conflict until cleared.

## Step 2 — Engagement Letter
Generate the engagement letter from the standard template (see /Templates/Letters). Choose the fee structure: hourly with evergreen retainer, blended rate, or flat fee. The letter must define scope explicitly — "general counsel services" is not an acceptable scope. Send via DocuSign; both the client and a partner must sign.

## Step 3 — Open the Matter
Request a matter number in format YYYY-NNN (for example 2025-041) from the records clerk. Never reuse matter numbers across engagements. Set up the matter folder tree from the standard template: /Correspondence, /Drafts, /Research, /Executed, /Billing.

## Step 4 — Billing Setup
For hourly matters: deposit the retainer in the trust account and set up evergreen replenishment at 80% of estimated monthly fees. For flat fees: set the milestone schedule in the billing system before work starts. Add the client to the billing system with the fee arrangement attached.

## Step 5 — Kickoff Call & Welcome Packet
Schedule a 30-minute kickoff within 5 business days of signature. Agenda: team introductions, communication cadence (weekly email summary is default), and turnaround expectations. Send the welcome packet: portal invitation, key contacts card, and our invoice schedule.

## Common Mistakes
Skipping the conflicts check "just to talk scope" is the #1 escalation we've had. Second most common: forgetting to set up retainer replenishment, which surfaces 60 days later as a billing fire drill.`,
  },
  {
    driveId: "drv_play_newhire",
    name: "New Hire Onboarding Checklist.docx",
    path: "/Firm Playbooks/New Hire Onboarding Checklist.docx",
    mimeType: "application/vnd.google-apps.document",
    ownerEmail: "alice@whitfield.legal",
    visibility: "EVERYONE",
    sharedWith: [],
    modifiedDaysAgo: 40,
    content: `## Week 1 — Systems & Access
Day 1: IT issues the laptop, enrolls you in MFA, and sets the 1Password vault invite — the IT helpdesk is it-help@whitfield.legal, extension 411. Day 2: practice-management and document-management training with Dana. Day 3: shadow two client calls with your assigned mentor. Day 4: cybersecurity policy read + attestation. Day 5: timesheet training; your first timesheet is due the following Friday.

## Week 2 — Practice Context
Assigned mentor check-ins are daily for 15 minutes. Complete the conflicts-system certification module. Read the client onboarding playbook and SOP-04 before touching any client document. New paralegals shadow the records clerk for half a day to learn matter-number requests.

## Weeks 3–4 — First Assignments
First supervised assignment comes from your mentor with a written scope note. The 30-day check-in with the office manager covers workload, tools, and any access gaps. Training budget: $1,500 per year after 90 days, pre-approved for CLE and practice-area courses.

## Benefits Enrollment
Benefits enrollment (health, dental, vision, 401k) must be completed within 31 days of your start date through the HR portal. Miss the window and coverage waits for open enrollment. The office manager can walk you through plan options.`,
  },
  {
    driveId: "drv_tmpl_engagement",
    name: "Engagement Letter Template (Standard).docx",
    path: "/Templates/Letters/Engagement Letter Template (Standard).docx",
    mimeType: "application/vnd.google-apps.document",
    ownerEmail: "alice@whitfield.legal",
    visibility: "EVERYONE",
    sharedWith: [],
    modifiedDaysAgo: 60,
    content: `## Scope of Engagement
Template scope paragraph: "The Firm will provide legal services relating to [describe matter]. Services outside this scope require a written amendment." Scope must be specific enough that a third party could tell what is and is not included.

## Fee Structure Options
Option A: hourly at the rates in the current rate sheet, with an evergreen retainer of 80% of estimated monthly fees. Option B: blended rate of $265 per hour for all timekeepers. Option C: flat fee with milestone schedule. Write-offs above $500 require managing-partner approval per the billing guide.

## Billing Cadence
Invoices are issued monthly by the 5th. Disbursements (filing fees, couriers) pass through at cost. Interest of 1.5% per month applies to balances over 60 days past due.

## Termination & Retention
Either party may terminate on 30 days' written notice. On termination the firm releases client files within 15 business days and retains the file for 7 years under the retention schedule, then destroys it with a certificate of destruction.

## Execution
Letters go out through DocuSign with two signatures required: the client and a partner. A matter number must exist before the letter is generated; the matter number goes in the letter footer.`,
  },
  {
    driveId: "drv_tmpl_nda",
    name: "NDA Template — Mutual (2-way).docx",
    path: "/Templates/Letters/NDA Template — Mutual (2-way).docx",
    mimeType: "application/vnd.google-apps.document",
    ownerEmail: "bob@whitfield.legal",
    visibility: "EVERYONE",
    sharedWith: [],
    modifiedDaysAgo: 26,
    content: `## Term & Mutual Obligations
Standard term is 3 years from the effective date. Obligations are mutual: each party protects the other's confidential information with the same care it uses for its own (no less than reasonable care).

## Carve-Outs
Information is not confidential when it: (1) is or becomes public through no breach, (2) was lawfully known before disclosure, (3) is independently developed without reference to the disclosed information, or (4) is rightly received from a third party without duty of confidentiality.

## Governing Law & Remedies
Governing law is Delaware. The template includes an injunctive-relief clause acknowledging money damages may be inadequate. Disputes go to arbitration in Wilmington under AAA commercial rules.

## Return & Destruction
Within 30 days of a written request, each party returns or destroys the other's confidential information, with a written certification; standard archival exception applies to automatic backups.

## Deal Notes from Prior Use
For M&A use, extend the term to 5 years and add a standstill rider. In supplier deals, strike the mutual protections down to one-way in the client's favor. Never let a client sign the mutual version when they're only receiving information.`,
  },
  {
    driveId: "drv_tmpl_billing",
    name: "Invoice & Billing Guide.docx",
    path: "/Templates/Finance/Invoice & Billing Guide.docx",
    mimeType: "application/vnd.google-apps.document",
    ownerEmail: "alice@whitfield.legal",
    visibility: "EVERYONE",
    sharedWith: [],
    modifiedDaysAgo: 17,
    content: `## Monthly Cycle
Bills go out by the 5th of each month. WIP review happens 3 business days before month-end: each timekeeper reviews their own draft time, and the supervising attorney adjusts descriptions. Bills drafted after WIP review flow straight to the billing partner.

## Write-Offs & Adjustments
Write-offs over $500 need managing-partner approval, logged in the billing system with a reason code. Courtesy discounts over 10% must be documented on the matter, not just applied to an invoice.

## E-Billing & Client Portals
Three clients use e-billing portals (Meridian Health uses Brightleaf, the two fund clients use Serengeti). Upload by the 3rd or their cycle rejects it. UTBMS task codes are mandatory on e-bills; the mapping cheat-sheet lives in this folder.

## Collections
Balances 60 days past due trigger a partner call, not an email. Balances 90 days past due go to the collections decision meeting on the first Tuesday of the month. We never send a client to collections without the managing partner signing off.

## Courtesy Holds
A courtesy hold freezes billing (not work) for one cycle when a client raises a question — apply it in the billing system so the invoice doesn't ship mid-dispute.`,
  },
  {
    driveId: "drv_tmpl_rates",
    name: "Billing Rate Sheet 2026.xlsx",
    path: "/Templates/Finance/Billing Rate Sheet 2026.xlsx",
    mimeType: "application/vnd.google-apps.spreadsheet",
    ownerEmail: "alice@whitfield.legal",
    visibility: "EVERYONE",
    sharedWith: [],
    modifiedDaysAgo: 3,
    content: `## Hourly Rates (effective January 1, 2026)
Managing Partner: $450 per hour. Senior Associate: $295 per hour. Associate: $235 per hour. Paralegal: $145 per hour. Records clerk and administrative support are billed at $95 per hour when chargeable.

## Blended & Alternative Arrangements
Standard blended rate: $265 per hour for any team mix. Extended relationship (3+ active matters): $250 blended. Monthly advisory retainer clients are custom-priced but never below $4,000 per month.

## Flat Fees
Trademark application (one class, US filing): $1,500 plus USPTO fees. Delaware LLC formation: $950 plus filing fees. Employment handbook review: $2,400. Client onboarding (internal, non-billable) is never charged.

## Rate Review Policy
Rates are reviewed each January. Mid-year exceptions require the managing partner's sign-off on the matter, not just the client's agreement. Discounted rates sunset after 12 months unless renewed in writing.`,
  },
  {
    driveId: "drv_res_deadlines",
    name: "Court Filing Deadlines Cheat Sheet.pdf",
    path: "/Practice Resources/Court Filing Deadlines Cheat Sheet.pdf",
    mimeType: "application/pdf",
    ownerEmail: "bob@whitfield.legal",
    visibility: "EVERYONE",
    sharedWith: [],
    modifiedDaysAgo: 11,
    content: `## Federal — Motions
Response to a motion under FRCP 12 or 56 opposition: 21 days after service. Reply in support: 14 days after the response. Motion to amend pleading: 14 days after service of the earlier motion where leave is required.

## Federal — Appeals & Other
Notice of appeal: 30 days after entry of judgment (60 days if the United States is a party). Rule 59 motion for new trial or amendment: 28 days. Rule 50 renewed JMOL: 28 days after entry of judgment.

## State (our district)
Motion responses: 14 days after service, replies 7 days. Notice of appeal: 30 days. Opposition to a discovery motion: 5 business days — the shortest clock we hit regularly.

## Extensions Protocol
One 7-day extension is granted as of right on civil motions by calling the clerk. Further extensions need a stipulation filed before the deadline, or a motion showing good cause. Never assume opposing counsel's email grants an extension — the docket controls.

## Docketing Rules
The docketing clerk calendar-controls every deadline the same day the triggering document arrives. Never compute a filing deadline yourself and rely on it — enter the trigger document and let the system calculate. Filing after 5:00pm counts as next-day unless the court has a night-drop.`,
  },
  {
    driveId: "drv_res_research",
    name: "Legal Research Guide.docx",
    path: "/Practice Resources/Legal Research Guide.docx",
    mimeType: "application/vnd.google-apps.document",
    ownerEmail: "bob@whitfield.legal",
    visibility: "EVERYONE",
    sharedWith: [],
    modifiedDaysAgo: 48,
    content: `## Databases
The firm's Westlaw account is primary; Lexis is secondary and shared — check the license dashboard before long pulls. Research costs above $250 on a matter get flagged to the billing partner automatically. Those costs are passed through to clients at cost, never marked up, and must appear as disbursements on the invoice.

## Research Memos
Every research memo is saved to the matter's /Research folder with naming RESEARCH-topic-YYYY-MM-DD. The memo must state the question presented, the answer in the first paragraph, and confidence level. A memo without a cited answer is a draft, not a memo.

## Cost Etiquette
Batch your searches; run alerts weekly instead of daily where the client is cost-sensitive. Two-seminar rule: if you're researching a brand-new practice area, book time with a practitioner in that group first — their 20 minutes saves the client $600 of database time.`,
  },
  {
    driveId: "drv_client_johnson",
    name: "Client FAQ — Johnson Family Trust.docx",
    path: "/Clients/Johnson Family Trust/Client FAQ — Johnson Family Trust.docx",
    mimeType: "application/vnd.google-apps.document",
    ownerEmail: "alice@whitfield.legal",
    visibility: "RESTRICTED",
    sharedWith: ["bob@whitfield.legal"],
    modifiedDaysAgo: 7,
    content: `## Trust Overview
The Johnson Family Trust is a revocable living trust established 2021, restated 2023. Both grantors (Ellen and Marcus Johnson) serve as co-trustees. The firm drafted the instrument and administers the annual accounting.

## Successor Trustee
Upon the incapacity or death of both grantors, the eldest child (Danielle Johnson) becomes successor trustee. If she is unable or unwilling, the corporate co-trustee at Fidelity Personal Trust serves alone. A physician's letter documenting incapacity is required before the successor takes over — no family consensus needed.

## Distribution Schedule
Beneficiaries receive one-third of principal at age 30, one-half of the remainder at 35, and the balance at 40. Health, education, maintenance, and support (HEMS) distributions may be made earlier at the trustee's discretion. The trustee documents discretionary distributions with a one-paragraph reason memo for the file.

## Fees & Amendments
Annual trust administration is billed at 8 hours of paralegal time plus 2 partner hours. Trust amendments are a $750 flat fee. Trustee fees for the corporate co-trustee are set by their schedule, currently 0.65% of assets under supervision annually.

## Transfers & Account Changes
Moving trust assets between institutions requires a medallion signature guarantee — schedule with Ellen directly; her bank provides it at the branch on Wednesdays. Annual trust accounting goes out each January covering the prior calendar year.`,
  },
  {
    driveId: "drv_client_acme_ma",
    name: "Matter 2024-017 — Acme Corp Acquisition (PRIVILEGED).docx",
    path: "/Clients/Acme Corp/M-2024-017/Matter 2024-017 — Acme Corp Acquisition (PRIVILEGED).docx",
    mimeType: "application/vnd.google-apps.document",
    ownerEmail: "alice@whitfield.legal",
    visibility: "RESTRICTED",
    sharedWith: [],
    modifiedDaysAgo: 2,
    content: `## Deal Summary
Whitfield & Associates represents Acme Corp (seller-side) in the sale of its industrial-components division to Halberd Industrials. Purchase price: $48,000,000, roughly 6.2 times trailing EBITDA. Signing target is March 15; closing is 45 days after signing.

## Escrow & Holdback
10% of the purchase price ($4.8M) goes into escrow for 18 months to secure indemnification obligations. The escrow agent is Cityline Bank; claims notice period runs 60 days before release.

## Reps & Warranties Insurance
RWI policy with a $2.4M premium covers breaches above a $1.2M retention. The policy excludes the known environmental condition at the Plattsburgh facility — that risk is allocated to the seller's indemnity cap.

## Closing Conditions & Outside Date
Conditions: HSR clearance, no material adverse effect, and delivery of the audited FY25 division financials. Outside date September 30 with two 30-day extensions. If HSR clearance hasn't arrived by the first extension, the buyer may walk with deposit return.

## Earnout
$3M earnout contingent on FY26 division revenue exceeding $19.5M, measured on a defined net-revenue basis, paid within 90 days of the FY26 audit. Disputes go to the independent accountant, not litigation.

## Privilege Note
This file is restricted to the deal team and privileged & confidential. Do not forward. Bob Alvarez is NOT on this matter — access requests go through the managing partner, and the litigation-hold notice applies (see companion file).`,
  },
  {
    driveId: "drv_client_acme_hold",
    name: "Acme Corp — Litigation Hold Notice (PRIVILEGED).docx",
    path: "/Clients/Acme Corp/M-2024-017/Acme Corp — Litigation Hold Notice (PRIVILEGED).docx",
    mimeType: "application/vnd.google-apps.document",
    ownerEmail: "alice@whitfield.legal",
    visibility: "RESTRICTED",
    sharedWith: [],
    modifiedDaysAgo: 2,
    content: `## Hold Scope
In connection with the product-liability claim (Hernandez v. Acme Corp), all documents, email, and messages relating to the division's hydraulic press line manufactured 2018–2023 must be preserved. The hold supersedes every retention schedule and auto-delete policy.

## Custodians
Current custodian list: engineering leads for the press line, QA supervisors 2018–2023, sales engineers for the northeastern territory, and the division controller. The list is reviewed monthly by the managing partner.

## Firm-Side Obligations
Firm staff must not delete or alter any Acme file, including drafts and working notes. Privilege review for productions follows SOP-04 (two-pass). Any question about scope goes to the managing partner before anything is destroyed — when in doubt, preserve.`,
  },
  {
    driveId: "drv_client_meridian",
    name: "Meridian Health — Services Agreement 2025.docx",
    path: "/Clients/Meridian Health/Meridian Health — Services Agreement 2025.docx",
    mimeType: "application/vnd.google-apps.document",
    ownerEmail: "alice@whitfield.legal",
    visibility: "RESTRICTED",
    sharedWith: ["bob@whitfield.legal"],
    modifiedDaysAgo: 30,
    content: `## Engagement Terms
Whitfield & Associates provides regulatory-counsel services to Meridian Health Clinics under a monthly retainer of $6,000, covering up to 20 attorney and paralegal hours per month. Hours beyond 20 bill at the blended rate of $280 per hour with notice to their GC before we exceed 24 hours.

## Service Levels
Non-urgent requests: response within 2 business days. Regulatory notices with statutory deadlines: same-day acknowledgment and a plan within 24 hours. Their GC (Priya Raman) must be copied on all substantive advice.

## Term & Termination
The agreement renews annually each January 1. Either party may terminate on 60 days' written notice. On termination we deliver a matters-in-flight summary and transfer records within 15 business days.

## Annual True-Up
Each January we reconcile hours: unused retainer hours do not roll over, but Meridian receives a credit of up to 4 hours against the following February if we under-delivered the minimum 12 response hours in any month.`,
  },
];

/**
 * A file that can be "dropped into" the simulated Drive by admins via the
 * demo tooling (simulates a colleague adding a policy) — deliberately
 * closes the "parental leave" documentation gap used in the demo script.
 */
export const SIMULATED_INCOMING_FILE: MockDriveFile = {
  driveId: "drv_policy_parental",
  name: "Paid Parental Leave Policy.pdf",
  path: "/Firm Policies/Paid Parental Leave Policy.pdf",
  mimeType: "application/pdf",
  ownerEmail: "alice@whitfield.legal",
  visibility: "EVERYONE",
  sharedWith: [],
  modifiedDaysAgo: 0,
  content: `## Eligibility
All full-time employees are eligible for paid parental leave after 90 days of employment. Parental leave covers birth, adoption, and foster placement.

## Duration & Pay
Primary caregivers receive 12 weeks at 100% of base salary. Secondary caregivers receive 4 weeks at 100% of base salary. Leave may be taken continuously or in two blocks within 12 months of the qualifying event.

## Coordination With Other Benefits
Parental leave runs concurrently with FMLA job protection. Short-term disability for childbirth recovery stacks with parental leave: 6 weeks disability at 60% plus full parental pay for the balance, administered by the carrier.

## Requesting Leave
Give 30 days' notice where foreseeable through the HR portal; emergencies can be raised to your manager directly. Benefits continue during leave at active-employee rates. Return-to-work schedule changes (phased return) are approved by the office manager.`,
};
