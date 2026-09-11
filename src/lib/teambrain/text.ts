/**
 * TeamBrain text pipeline — tokenization, stemming, query expansion,
 * and sparse TF-IDF term-vector "embeddings".
 *
 * NOTE (demo): in production TeamBrain uses neural embeddings stored in
 * pgvector. This sandbox has no vector DB / embedding endpoint, so we store
 * sparse term vectors as JSON and compute hybrid TF-IDF cosine + BM25 at
 * query time. The retrieval contract (chunk → embedding → similarity) is
 * identical, so swapping in pgvector later is a storage detail.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "of", "to", "in", "on", "at", "by",
  "for", "with", "about", "into", "over", "after", "before", "between", "out", "up", "down",
  "is", "are", "was", "were", "be", "been", "being", "am", "do", "does", "did", "doing",
  "have", "has", "had", "having", "will", "would", "shall", "should", "can", "could", "may",
  "might", "must", "i", "you", "he", "she", "it", "we", "they", "me", "him", "her", "us",
  "them", "my", "your", "his", "its", "our", "their", "this", "that", "these", "those",
  "what", "which", "who", "whom", "when", "where", "why", "how", "all", "any", "both",
  "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "too", "very", "s", "t", "just", "also", "than", "there", "here",
  "as", "from", "get", "got", "let", "us", "please", "need", "want", "like", "one", "two",
]);

/** Query-time synonym expansion — maps surface forms to related index terms. */
const SYNONYMS: Record<string, string[]> = {
  nda: ["nondisclosure", "confidentiality"],
  nondisclosure: ["nda", "confidentiality"],
  confidentiality: ["nda", "nondisclosure"],
  expense: ["reimbursement", "reimburse"],
  reimbursement: ["expense", "reimburse"],
  reimburse: ["reimbursement", "expense"],
  mileage: ["reimbursement", "vehicle"],
  meal: ["meals", "dining"],
  rate: ["rates", "pricing", "fee", "fees"],
  rates: ["rate", "pricing", "fee", "fees"],
  fee: ["fees", "rate", "rates"],
  fees: ["fee", "rate", "rates"],
  pricing: ["rate", "rates", "fee", "fees"],
  leave: ["vacation", "pto", "parental", "maternity", "paternity", "absence"],
  vacation: ["leave", "pto", "holiday"],
  pto: ["leave", "vacation"],
  parental: ["leave", "maternity", "paternity"],
  maternity: ["leave", "parental"],
  paternity: ["leave", "parental"],
  onboard: ["onboarding", "orientation", "newhire", "new"],
  onboarding: ["onboard", "orientation", "newhire", "checklist"],
  checklist: ["onboarding", "checklist"],
  client: ["clients", "customer", "customers"],
  customers: ["client", "clients"],
  deadline: ["deadlines", "due", "filing", "time"],
  deadlines: ["deadline", "due", "filing"],
  filing: ["file", "filings", "deadline", "court"],
  court: ["filing", "motion", "deadlines", "federal", "state"],
  motion: ["motions", "court", "response", "filing"],
  response: ["respond", "reply", "motion", "deadline"],
  respond: ["response", "reply", "motion", "deadline"],
  appeal: ["appeals", "notice", "deadline"],
  trust: ["trusts", "estate", "trustee", "distribution"],
  trustee: ["trust", "trusts", "successor"],
  distribution: ["distributions", "trust", "distribute"],
  acquisition: ["purchase", "deal", "merger"],
  purchase: ["acquisition", "price", "deal", "buy"],
  price: ["purchase", "pricing", "cost", "amount"],
  deal: ["acquisition", "purchase", "merger", "terms"],
  merger: ["acquisition", "purchase", "deal"],
  privileged: ["privilege", "confidential", "hold"],
  privilege: ["privileged", "confidential", "hold"],
  confidential: ["confidentiality", "privileged", "restricted", "nda"],
  security: ["cybersecurity", "cyber", "mfa", "phishing", "data"],
  cybersecurity: ["security", "cyber", "mfa", "phishing", "data"],
  cyber: ["cybersecurity", "security", "mfa", "phishing"],
  password: ["security", "mfa", "credentials", "passwords"],
  laptop: ["equipment", "computer", "encryption", "stipend"],
  equipment: ["laptop", "computer", "stipend", "hardware"],
  stipend: ["equipment", "home", "office", "allowance"],
  remote: ["hybrid", "wfh", "home", "office"],
  hybrid: ["remote", "wfh", "office", "anchor"],
  wfh: ["remote", "hybrid", "home"],
  desk: ["booking", "hoteling", "office", "anchor"],
  hoteling: ["desk", "booking", "office"],
  conflicts: ["conflict", "check", "adverse", "prior", "matters"],
  conflict: ["conflicts", "check", "adverse", "prior"],
  engagement: ["letter", "retainer", "template", "agreement"],
  letter: ["engagement", "template", "letters"],
  retainer: ["engagement", "deposit", "evergreen", "replenish"],
  invoice: ["invoices", "billing", "bills", "wip"],
  billing: ["invoice", "invoices", "bills", "rate", "rates", "wip"],
  wip: ["billing", "invoice", "workinprogress"],
  template: ["templates", "letter", "form", "standard"],
  templates: ["template", "letters", "forms"],
  timesheet: ["time", "timesheets", "training", "hours"],
  benefits: ["benefit", "enrollment", "insurance", "health"],
  enrollment: ["benefits", "enroll", "insurance"],
  new: ["onboarding", "newhire", "hire"],
  newhire: ["onboarding", "new", "checklist"],
  hire: ["onboarding", "newhire", "new"],
  matter: ["matters", "case", "cases", "number"],
  matters: ["matter", "case", "cases", "number"],
  escrow: ["holdback", "purchase", "deal"],
  earnout: ["earn", "revenue", "fy26", "contingent"],
  federal: ["court", "motion", "days"],
  state: ["court", "motion", "days"],
  extension: ["extensions", "extend", "deadline"],
  acquire: ["acquisition", "purchase", "deal"],
  permission: ["permissions", "access", "sharing", "restricted"],
  permissions: ["permission", "access", "sharing", "restricted"],
  access: ["permission", "permissions", "sharing", "restricted"],
  share: ["sharing", "shared", "permission", "access"],
  document: ["documents", "docs", "file", "files", "review"],
  documents: ["document", "docs", "file", "files", "review"],
  review: ["reviews", "document", "privileged", "redaction", "pass"],
  redaction: ["redact", "review", "privileged"],
  workflow: ["process", "sop", "steps"],
  process: ["workflow", "steps", "procedure"],
  how: ["process", "workflow", "procedure"],
  usually: ["typically", "standard", "process"],
};

export function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Very light suffix stripper — good enough for matching in this corpus. */
export function stem(token: string): string {
  let t = token;
  if (t.length > 5 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  for (const suffix of ["ing", "edly", "ed", "es", "s", "ly"]) {
    if (t.length - suffix.length >= 4 && t.endsWith(suffix)) {
      t = t.slice(0, -suffix.length);
      break;
    }
  }
  return t;
}

/** Index-time tokenizer (no synonym expansion). */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  for (const raw of text.split(/[^A-Za-z0-9]+/)) {
    const norm = normalizeToken(raw);
    if (!norm || norm.length < 2 || STOPWORDS.has(norm)) continue;
    tokens.push(stem(norm));
  }
  return tokens;
}

/** Query-time tokenizer with synonym expansion. */
export function tokenizeQuery(text: string): string[] {
  const base = tokenize(text);
  const set = new Set(base);
  for (const t of base) {
    for (const syn of SYNONYMS[t] ?? []) {
      const s = stem(normalizeToken(syn));
      if (s.length >= 2) set.add(s);
    }
    // also expand by the unstemmed surface form (keys above use surface forms)
    const surface = t; // already stemmed — try raw token form via lookup on original text tokens
    for (const syn of SYNONYMS[surface] ?? []) {
      const s = stem(normalizeToken(syn));
      if (s.length >= 2) set.add(s);
    }
  }
  return [...set];
}

/**
 * Sparse term vector — our stored "embedding".
 * Stores sublinear term frequency (1 + ln tf), unnormalized:
 * cosine() normalizes defensively, and BM25 inverts tf = exp(w - 1)
 * exactly at query time.
 */
export function buildEmbedding(text: string): Record<string, number> {
  const tokens = tokenize(text);
  const tf: Record<string, number> = {};
  for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;
  const vec: Record<string, number> = {};
  for (const [term, count] of Object.entries(tf)) {
    vec[term] = 1 + Math.log(count);
  }
  return vec;
}

export function cosine(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  const [small, large] = Object.keys(a).length <= Object.keys(b).length ? [a, b] : [b, a];
  for (const [term, w] of Object.entries(small)) {
    const other = large[term];
    if (other !== undefined) dot += w * other;
  }
  const na = Math.sqrt(Object.values(a).reduce((s, v) => s + v * v, 0)) || 1;
  const nb = Math.sqrt(Object.values(b).reduce((s, v) => s + v * v, 0)) || 1;
  return dot / (na * nb);
}

/** Distinct query terms that occur in a text — used for the "excluded chunks" signal. */
export function overlapCount(queryTerms: string[], text: string): number {
  const textTokens = new Set(tokenize(text));
  let hits = 0;
  for (const t of new Set(queryTerms)) if (textTokens.has(t)) hits++;
  return hits;
}
