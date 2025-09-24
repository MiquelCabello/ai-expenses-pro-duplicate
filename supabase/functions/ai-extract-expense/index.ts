/// <reference path="../types.d.ts" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    status: init.status ?? 200,
  })

type DocType = 'FACTURA' | 'TICKET'

type ClassifyResult = {
  type: DocType
  reason?: string
  confidence?: number
}

type InvoiceExtractResult = {
  vendor: string | null
  expense_date: string | null
  amount_gross: number | null
  tax_vat: number | null
  amount_net: number | null
  currency: string | null
  invoice_number: string | null
  seller_tax_id: string | null
  buyer_tax_id: string | null
  tax_id: string | null
  email: string | null
  notes: string | null
  ocr_text: string | null
}

type TicketExtractResult = {
  vendor: string | null
  expense_date: string | null
  amount_total: number | null
  tax_vat: number | null
  amount_net: number | null
  currency: string | null
  payment_method: string | null
  notes: string | null
  ocr_text: string | null
}

type ExtractionOutcome =
  | { type: 'FACTURA'; data: InvoiceExtractResult }
  | { type: 'TICKET'; data: TicketExtractResult }

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-pro-latest'

async function callGeminiJSON({
  apiKey,
  model,
  prompt,
  base64,
  mime,
  responseMime = 'application/json',
  retries = 2,
}: {
  apiKey: string
  model: string
  prompt: string
  base64: string
  mime: string
  responseMime?: string
  retries?: number
}): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const body = {
    contents: [
      { role: 'user', parts: [ { text: prompt }, { inlineData: { data: base64, mimeType: mime } } ] },
    ],
    generationConfig: {
      temperature: 0,
      topP: 1,
      topK: 1,
      maxOutputTokens: 4096,
      response_mime_type: responseMime,
    },
  }

  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
      const j = await res.json()
      const text = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!text) throw new Error('Gemini sin contenido')
      const parsed = safeJsonParseFromText(text)
      if (!parsed) throw new Error('Gemini devolvió texto no-JSON')
      return parsed
    } catch (err) {
      lastErr = err
      await sleep(200 * (i + 1))
    }
  }
  throw lastErr ?? new Error('Gemini fallo desconocido')
}

function buildClassifyPrompt(fileName: string) {
  return `Eres un clasificador de documentos de gasto. Devuelve SOLO JSON válido.\n\nReglas (en orden):\n1) Si ves "Factura simplificada" / "Simplified invoice" => "TICKET".\n2) Si detectas DOS identificadores fiscales distintos (NIF/NIE/CIF/VAT, vendedor+comprador) => "FACTURA".\n3) Si hay Nº de factura visible (p. ej., "Factura #", "Invoice No.", "FAC-2024-...") => "FACTURA".\n4) Si aparece la palabra "Factura" o "Invoice" (y NO dice "simplificada") => "FACTURA".\n5) Un único CIF/NIF/VAT NO basta por sí solo.\n6) Si de verdad no puedes decidir => "TICKET".\n\nFormato EXACTO: {"type":"FACTURA|TICKET","reason":"...","confidence":0..1}\n\nContexto:\n- Nombre de archivo: ${fileName}`
}

function buildInvoiceExtractPrompt() {
  return `Eres un extractor de datos de FACTURAS. Devuelve SOLO JSON válido con estas claves (usa null si no aplica):\n{\n  "vendor": string|null,\n  "expense_date": string|null,        // YYYY-MM-DD\n  "amount_gross": number|null,\n  "tax_vat": number|null,\n  "amount_net": number|null,\n  "currency": string|null,\n  "invoice_number": string|null,\n  "seller_tax_id": string|null,\n  "buyer_tax_id": string|null,\n  "tax_id": string|null,\n  "email": string|null,\n  "notes": string|null,\n  "ocr_text": string|null             // TEXTO OCR COMPLETO\n}\n\nReglas:\n- "expense_date" en formato YYYY-MM-DD si es posible.\n- Importes con punto decimal (ej. 1234.56).\n- Si no observas el dato, devuelve null.\n- No inventes números de factura ni identificadores fiscales.\n- "ocr_text" debe contener TODO el texto legible tal como aparece.`
}

function buildTicketExtractPrompt() {
  return `Eres un extractor de datos de TICKETS o RECIBOS SIMPLIFICADOS. Devuelve SOLO JSON válido con estas claves (usa null si no aplica):\n{\n  "vendor": string|null,\n  "expense_date": string|null,        // YYYY-MM-DD\n  "amount_total": number|null,\n  "tax_vat": number|null,\n  "amount_net": number|null,\n  "currency": string|null,\n  "payment_method": string|null,\n  "notes": string|null,\n  "ocr_text": string|null             // TEXTO OCR COMPLETO\n}\n\nReglas:\n- "expense_date" en formato YYYY-MM-DD si es posible.\n- Importes con punto decimal (ej. 45.90).\n- Si no ves el dato, usa null.\n- No inventes métodos de pago ni importes.\n- "ocr_text" debe contener TODO el texto legible tal como aparece.`
}

serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 })

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''
    if (!GEMINI_API_KEY) return json({ success: false, error: 'Falta GEMINI_API_KEY' }, { status: 500 })

    const contentType = req.headers.get('content-type') || ''

    let file: File | undefined
    let fileUrl = ''
    let mime_type = ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      file = formData.get('file') as File
      fileUrl = String(formData.get('file_url') || '')
      mime_type = String(formData.get('mime_type') || '')
    } else {
      const body = await req.json().catch(() => ({} as any))
      fileUrl = String(body?.file_url || '')
      mime_type = String(body?.mime_type || '')
    }

    if (!file && !fileUrl) return json({ success: false, error: 'No se recibió archivo ni URL' }, { status: 400 })

    const fileName = (file?.name || fileUrl.split('?')[0].split('/').pop() || 'documento')

    let base64 = ''
    let mime = mime_type || 'application/octet-stream'

    if (file) {
      const r = await fileToBase64(file)
      base64 = r.base64
      mime = r.mime || mime
    } else {
      const r = await urlToBase64(fileUrl)
      base64 = r.base64
      mime = r.mime || mime
    }

    const classification = await callGeminiJSON({
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      prompt: buildClassifyPrompt(fileName),
      base64,
      mime,
    }) as ClassifyResult

    const docType: DocType = classification?.type === 'FACTURA' ? 'FACTURA' : 'TICKET'

    const extractionPrompt = docType === 'FACTURA' ? buildInvoiceExtractPrompt() : buildTicketExtractPrompt()

    const extractionRaw = await callGeminiJSON({
      apiKey: GEMINI_API_KEY,
      model: GEMINI_MODEL,
      prompt: extractionPrompt,
      base64,
      mime,
    }) as Record<string, unknown>

    const extraction: ExtractionOutcome = docType === 'FACTURA'
      ? { type: 'FACTURA', data: normalizeInvoice(extractionRaw) }
      : { type: 'TICKET', data: normalizeTicket(extractionRaw) }

    console.log('[ai-extract-expense] clasificación', classification)
    console.log('[ai-extract-expense] extracción', extraction)

    return json({ success: true, classification, extraction })
  } catch (err: any) {
    console.error('[ai-extract-expense] error', err)
    return json({ success: false, error: String(err?.message || err) }, { status: 500 })
  }
})

function normalizeInvoice(raw: Record<string, unknown>): InvoiceExtractResult {
  return {
    vendor: toStringOrNull(raw.vendor),
    expense_date: toISO(raw.expense_date),
    amount_gross: normalizeNumber(raw.amount_gross),
    tax_vat: normalizeNumber(raw.tax_vat),
    amount_net: normalizeNumber(raw.amount_net),
    currency: toCurrency(raw.currency),
    invoice_number: sanitizeId(toStringOrNull(raw.invoice_number)),
    seller_tax_id: sanitizeId(toStringOrNull(raw.seller_tax_id)),
    buyer_tax_id: sanitizeId(toStringOrNull(raw.buyer_tax_id)),
    tax_id: sanitizeId(toStringOrNull(raw.tax_id)),
    email: toStringOrNull(raw.email),
    notes: toStringOrNull(raw.notes),
    ocr_text: toPlainText(raw.ocr_text),
  }
}

function normalizeTicket(raw: Record<string, unknown>): TicketExtractResult {
  return {
    vendor: toStringOrNull(raw.vendor),
    expense_date: toISO(raw.expense_date),
    amount_total: normalizeNumber(raw.amount_total),
    tax_vat: normalizeNumber(raw.tax_vat),
    amount_net: normalizeNumber(raw.amount_net),
    currency: toCurrency(raw.currency),
    payment_method: toStringOrNull(raw.payment_method),
    notes: toStringOrNull(raw.notes),
    ocr_text: toPlainText(raw.ocr_text),
  }
}

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s.length ? s : null
}

function toPlainText(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  try { return JSON.stringify(value) } catch { return String(value) }
}

function toCurrency(value: unknown): string | null {
  const s = toStringOrNull(value)
  if (!s) return null
  return s.toUpperCase().slice(0, 5)
}

function sanitizeId(value: string | null): string | null {
  if (!value) return null
  const cleaned = value.replace(/\s+/g, '')
  return cleaned.length ? cleaned : null
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && isFinite(value)) return value
  if (typeof value === 'string') {
    const s = value.replace(/\s/g, '').replace(/,/g, '.')
    const f = parseFloat(s)
    if (!isNaN(f)) return f
  }
  return null
}

function toISO(value: unknown): string | null {
  const s = toStringOrNull(value)
  if (!s) return null
  const normalized = s.replace(/\./g, '-').replace(/\//g, '-')
  const iso = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const eu = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (eu) return `${eu[3]}-${eu[2]}-${eu[1]}`
  return null
}

async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  const buf = new Uint8Array(await file.arrayBuffer())
  return { base64: encodeBase64(buf), mime: file.type || 'application/octet-stream' }
}

async function urlToBase64(url: string): Promise<{ base64: string; mime: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No pude descargar ${url}`)
  const mime = res.headers.get('content-type') || 'application/octet-stream'
  const buf = new Uint8Array(await res.arrayBuffer())
  return { base64: encodeBase64(buf), mime }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode.apply(null, Array.from(chunk) as unknown as number[])
  }
  return btoa(binary)
}

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)) }

function safeJsonParseFromText(text: string) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  const candidate = text.slice(start, end + 1)
  try { return JSON.parse(candidate) } catch { return null }
}
