// Archivo: src/lib/classifyDocType.ts — v2 (mismo archivo, reemplaza anterior)
// Mejora clave: si el pipeline no rellena seller/buyer/invoice_number,
// inferimos desde OCR (texto completo). Con esto, casos como
// "FACTURA #F253282" + "B75977868" + "78222262K" clasifican como FACTURA (R1).

export type DocType = 'invoice' | 'ticket'
export type ClassificationSource = 'ai' | 'user' | 'db-fallback'

export interface ExtractedExpenseFields {
  seller_tax_id?: string | null
  buyer_tax_id?: string | null
  invoice_number?: string | null
  detected_keywords?: string[] | null
  ocr_text?: string | null
  [k: string]: unknown
}

export interface ClassificationResult {
  aiSuggestion: DocType
  classification_path: 'R1' | 'R2' | 'R3' | 'R4'
}

const DEBUG_DOC_TYPE =
  typeof window !== 'undefined' &&
  (import.meta.env?.DEV || import.meta.env?.VITE_DEBUG_DOC_CLASSIFICATION === 'true')

export function classifyDocType(extracted: ExtractedExpenseFields): ClassificationResult {
  const text = (extracted.ocr_text || '').toString()
  const invoiceNumberRaw = normalize(extracted.invoice_number) || extractInvoiceNumber(text)
  const textLower = text.toLowerCase()

  // 1) Reunimos tax IDs:
  const idsFromFields = [normalizeTaxId(extracted.seller_tax_id), normalizeTaxId(extracted.buyer_tax_id)].filter(Boolean) as string[]
  const idsFromText = extractTaxIds(text)
  const allIds = unique([...idsFromFields, ...idsFromText])

  // Priorizamos el primer ID como vendedor para reglas posteriores
  const sellerId = idsFromFields[0] || allIds[0] || null

  if (containsSimplifiedInvoice(textLower)) {
    debugLogClassification('ticket:simplified-invoice', {
      invoiceNumberRaw,
      idsFromFields,
      idsFromText,
      allIds,
      snippet: textLower.slice(0, 200),
    })
    return { aiSuggestion: 'ticket', classification_path: 'R4' }
  }

  // R1 (fuerte): basta con detectar 2 identificadores fiscales distintos en el documento
  if (allIds.length >= 2) {
    debugLogClassification('invoice:R1:two-tax-ids', {
      invoiceNumberRaw,
      idsFromFields,
      idsFromText,
      allIds,
    })
    return { aiSuggestion: 'invoice', classification_path: 'R1' }
  }

  // Palabras clave robustas
  const kw = new Set<string>()
  ;(extracted.detected_keywords || []).forEach((k) => kw.add(String(k).toLowerCase()))
  inferKeywordsFromText(text).forEach((k) => kw.add(k))

  // R2 (estándar): nº factura + 1 tax id (vendedor)
  if (invoiceNumberRaw && sellerId) {
    debugLogClassification('invoice:R2:number+seller', {
      invoiceNumberRaw,
      idsFromFields,
      idsFromText,
      allIds,
      keywords: Array.from(kw),
    })
    return { aiSuggestion: 'invoice', classification_path: 'R2' }
  }

  // R3 (heurística): nº factura + palabra "factura/invoice"
  if (invoiceNumberRaw && hasInvoiceishKeyword(kw)) {
    debugLogClassification('invoice:R3:number+keyword', {
      invoiceNumberRaw,
      idsFromFields,
      idsFromText,
      allIds,
      keywords: Array.from(kw),
    })
    return { aiSuggestion: 'invoice', classification_path: 'R3' }
  }

  // R3 (alternativa): nº factura + un ID aunque falte keyword explícita
  if (invoiceNumberRaw && allIds.length >= 1) {
    debugLogClassification('invoice:R3:number+id', {
      invoiceNumberRaw,
      idsFromFields,
      idsFromText,
      allIds,
      keywords: Array.from(kw),
    })
    return { aiSuggestion: 'invoice', classification_path: 'R3' }
  }

  // R3 (alternativa): palabra factura/invoice + un identificador fiscal
  if (hasInvoiceishKeyword(kw) && allIds.length >= 1) {
    debugLogClassification('invoice:R3:keyword+id', {
      invoiceNumberRaw,
      idsFromFields,
      idsFromText,
      allIds,
      keywords: Array.from(kw),
    })
    return { aiSuggestion: 'invoice', classification_path: 'R3' }
  }

  // R4 (fallback): ticket
  debugLogClassification('ticket:R4:fallback', {
    invoiceNumberRaw,
    idsFromFields,
    idsFromText,
    allIds,
    keywords: Array.from(kw),
    snippet: textLower.slice(0, 200),
  })
  return { aiSuggestion: 'ticket', classification_path: 'R4' }
}

export function finalizeDocType(
  ai: ClassificationResult,
  userChoice: DocType | undefined
): { doc_type: DocType; doc_type_source: ClassificationSource; classification_path: ClassificationResult['classification_path'] } {
  const doc_type = userChoice ?? ai.aiSuggestion
  const doc_type_source: ClassificationSource = userChoice ? 'user' : 'ai'
  return { doc_type, doc_type_source, classification_path: ai.classification_path }
}

// ---------------- helpers ----------------

function normalize(v?: string | null): string | null {
  if (v == null) return null
  const s = String(v).trim().toUpperCase()
  return s.length ? s : null
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

// Intenta extraer el nº de factura del texto (muy tolerante)
function extractInvoiceNumber(text: string): string | null {
  if (!text) return null
  const t = text.replace(/\s+/g, ' ')
  const patterns: RegExp[] = [
    /\bFACTURA\s*(?:N[ºO]\.?\s*)?#?\s*([A-Z0-9./-]{3,}(?:\d[ A-Z0-9./-]*)?)/i,
    /\bINVOICE\s*(?:NO\.|NUMBER|#)?\s*([A-Z0-9./-]{3,}(?:\d[ A-Z0-9./-]*)?)/i,
  ]
  for (const rx of patterns) {
    const m = rx.exec(t)
    if (m?.[1] && /\d/.test(m[1])) return m[1].toUpperCase()
  }
  return null
}

// Extrae posibles NIF/CIF/NIE españoles (y VAT-ID similares) del texto
function extractTaxIds(text: string): string[] {
  if (!text) return []
  const clean = text
    .replace(/\bHoja\s+B-?\d+\b/gi, '') // evita "Hoja B-630518" del Registro Mercantil
    .replace(/[()]/g, ' ')

  const ids = new Set<string>()

  const rxCIF = /(^|[^A-Z0-9])([A-HJ-NP-SU-W](?:[\s./-]?\d){7}(?:[\s./-]?[A-Z0-9])?)(?=$|[^A-Z0-9])/gi
  collectMatches(clean, rxCIF, ids, 2)

  const rxNIF = /(^|[^A-Z0-9])((?:[XYZ](?:[\s./-]?\d){7}|(?:\d[\s./-]?){8})[\s./-]?[A-Z])(?=$|[^A-Z0-9])/gi
  collectMatches(clean, rxNIF, ids, 2)

  const rxVAT = /(^|[^A-Z0-9])([A-Z]{2,3}(?:[\s./-]?[0-9A-Z]){6,})(?=$|[^A-Z0-9])/gi
  collectMatches(clean, rxVAT, ids, 2)

  return Array.from(ids).filter(isLikelyTaxId)
}

function normalizeTaxId(v?: string | null): string | null {
  if (v == null) return null
  const s = String(v).trim().toUpperCase().replace(/[\s./:-]/g, '')
  return s.length ? s : null
}

function isLikelyTaxId(id: string): boolean {
  if (id.length < 8 || id.length > 14) return false
  if (!/[A-Z]/.test(id) || !/\d/.test(id)) return false

  // CIF: letra inicial + 7 dígitos + dígito/letra de control
  if (/^[A-HJ-NP-SU-W]\d{7}[0-9A-Z]$/.test(id)) return true

  // NIF: 8 dígitos + letra
  if (/^\d{8}[A-Z]$/.test(id)) return true

  // NIE: X/Y/Z + 7 dígitos + letra
  if (/^[XYZ]\d{7}[A-Z]$/.test(id)) return true

  // VAT genérico: prefijo 2-3 letras + alfanumérico
  if (/^[A-Z]{2,3}[0-9A-Z]{6,11}$/.test(id)) {
    const prefixLen = /^[A-Z]{3}/.test(id) ? 3 : 2
    const suffix = id.slice(prefixLen)
    const digitCount = (suffix.match(/\d/g) || []).length
    const hasEarlyDigit = /\d/.test(suffix.slice(0, 5))
    if (digitCount >= 2 && hasEarlyDigit) return true
  }

  return false
}

function collectMatches(text: string, regex: RegExp, bucket: Set<string>, captureIndex = 0) {
  let match: RegExpExecArray | null
  while ((match = regex.exec(text))) {
    const raw = captureIndex > 0 ? match[captureIndex] : match[0]
    const normalized = normalizeTaxId(raw)
    if (normalized) bucket.add(normalized)
  }
}

function inferKeywordsFromText(text: string): string[] {
  if (!text) return []
  const kws: string[] = []
  const patterns: Array<[string, RegExp]> = [
    ['invoice', /\b(invoice|factura)\b/gi],
    ['vat', /\b(vat|iva)\b/gi],
    ['nif', /\b(nif|cif|nie|vat\s*id)\b/gi],
    ['invoice_number', /\b(factura\s*(n[ºo]\.?|#)|invoice\s*(no\.|number|#))\b/gi],
  ]
  for (const [name, rx] of patterns) {
    if (rx.test(text)) kws.push(name)
  }
  return kws
}

function hasInvoiceishKeyword(set: Set<string>): boolean {
  return set.has('invoice') || set.has('invoice_number')
}

function containsSimplifiedInvoice(textLower: string): boolean {
  return textLower.includes('factura simplificada') || textLower.includes('simplified invoice')
}

function debugLogClassification(step: string, payload: Record<string, unknown>) {
  if (!DEBUG_DOC_TYPE) return
  try {
    const info = {
      ...payload,
      timestamp: new Date().toISOString(),
    }
    console.groupCollapsed(`[classifyDocType] ${step}`)
    if (typeof console.table === 'function') {
      console.table(info)
    } else {
      console.log(info)
    }
    if ('snippet' in info && typeof info.snippet === 'string') {
      console.log('snippet', info.snippet)
    }
    console.groupEnd()
  } catch (error) {
    console.warn('[classifyDocType] debug log failed', error)
  }
}
