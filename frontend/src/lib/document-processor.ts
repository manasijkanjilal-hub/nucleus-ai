/**
 * Document processing utilities for the Context Vault.
 *
 * Responsibilities:
 *   - Validate uploaded files by *content* (magic bytes), not just extension.
 *   - Extract plain text from PDF, DOCX and TXT/MD files.
 *   - Split extracted text into overlapping chunks suitable for embedding.
 *   - Compute metadata (word count, page count, chunk count).
 *
 * PDF extraction uses `unpdf` (a serverless-friendly build of pdf.js) which
 * avoids the test-fixture loading problems pdf-parse has under Next.js.
 * DOCX uses `mammoth`. TXT/MD are read directly.
 */

import mammoth from 'mammoth';

export type SupportedDocType = 'PDF' | 'DOCX' | 'TXT';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES: Record<string, SupportedDocType> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'DOCX',
  'application/msword': 'DOCX',
  'text/plain': 'TXT',
  'text/markdown': 'TXT',
};

export const ALLOWED_EXTENSIONS: Record<string, SupportedDocType> = {
  '.pdf': 'PDF',
  '.docx': 'DOCX',
  '.doc': 'DOCX',
  '.txt': 'TXT',
  '.md': 'TXT',
};

export interface ChunkingOptions {
  /** Target chunk size in characters. */
  chunkSize?: number;
  /** Overlap between consecutive chunks in characters. */
  chunkOverlap?: number;
}

export interface ExtractionResult {
  text: string;
  pageCount: number | null;
  wordCount: number;
}

export interface ProcessedDocument extends ExtractionResult {
  chunks: string[];
  chunkCount: number;
}

export interface FileValidation {
  valid: boolean;
  docType?: SupportedDocType;
  error?: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx === -1 ? '' : fileName.slice(idx).toLowerCase();
}

/**
 * Inspect the leading bytes of a buffer to confirm the real file type.
 *   - PDF  : starts with "%PDF"
 *   - DOCX : ZIP container, starts with "PK\x03\x04"
 *   - TXT  : must be valid UTF-8-ish text (no NUL bytes in the sample)
 */
export function detectTypeFromBytes(
  buffer: Buffer
): SupportedDocType | 'UNKNOWN' {
  if (buffer.length >= 4) {
    if (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    ) {
      return 'PDF';
    }
    if (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
    ) {
      // ZIP container — DOCX (and other OOXML) are zips.
      return 'DOCX';
    }
  }
  // Heuristic for text: sample the first 2KB for NUL bytes.
  const sample = buffer.subarray(0, Math.min(2048, buffer.length));
  const hasNul = sample.includes(0x00);
  return hasNul ? 'UNKNOWN' : 'TXT';
}

/**
 * Validate a file by declared mime/extension AND actual content bytes.
 */
export function validateFile(params: {
  fileName: string;
  mimeType: string;
  size: number;
  buffer: Buffer;
}): FileValidation {
  const { fileName, mimeType, size, buffer } = params;

  if (size <= 0) return { valid: false, error: 'File is empty' };
  if (size > MAX_FILE_BYTES) {
    return {
      valid: false,
      error: `File exceeds the ${Math.round(
        MAX_FILE_BYTES / (1024 * 1024)
      )}MB limit`,
    };
  }

  const ext = getExtension(fileName);
  const byExt = ALLOWED_EXTENSIONS[ext];
  const byMime = ALLOWED_MIME_TYPES[mimeType];

  if (!byExt && !byMime) {
    return {
      valid: false,
      error: 'Unsupported file type. Allowed: PDF, DOCX, TXT, MD',
    };
  }

  const declared = byMime || byExt;
  const detected = detectTypeFromBytes(buffer);

  if (detected === 'UNKNOWN') {
    return {
      valid: false,
      error: 'File content could not be verified as a supported type',
    };
  }

  // Content must be consistent with the declared type. TXT is permissive
  // (markdown, plain text, etc. all read as text).
  if (declared !== detected && !(declared === 'TXT' && detected === 'TXT')) {
    // Allow DOCX detected as zip even when mime says msword, etc.
    if (!(declared === 'DOCX' && detected === 'DOCX')) {
      return {
        valid: false,
        error: `File content (${detected}) does not match its declared type (${declared})`,
      };
    }
  }

  return { valid: true, docType: detected };
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  // Dynamic import keeps unpdf out of the module graph until needed and avoids
  // bundler issues with its wasm/worker assets.
  const { extractText, getDocumentProxy } = await import('unpdf');
  const uint8 = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(uint8);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join('\n\n') : text;
  return {
    text: merged.trim(),
    pageCount: totalPages ?? null,
    wordCount: countWords(merged),
  };
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const { value } = await mammoth.extractRawText({ buffer });
  return {
    text: value.trim(),
    pageCount: null,
    wordCount: countWords(value),
  };
}

function extractTxt(buffer: Buffer): ExtractionResult {
  const text = buffer.toString('utf8');
  return { text: text.trim(), pageCount: null, wordCount: countWords(text) };
}

/** Extract plain text from a supported document buffer. */
export async function extractText(
  buffer: Buffer,
  docType: SupportedDocType
): Promise<ExtractionResult> {
  switch (docType) {
    case 'PDF':
      return extractPdf(buffer);
    case 'DOCX':
      return extractDocx(buffer);
    case 'TXT':
      return extractTxt(buffer);
    default:
      throw new Error(`Unsupported document type: ${docType}`);
  }
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

/**
 * Split text into overlapping chunks. Tries to break on paragraph / sentence
 * boundaries near the target size to keep chunks coherent.
 */
export function chunkText(
  text: string,
  options: ChunkingOptions = {}
): string[] {
  const chunkSize = options.chunkSize ?? 800;
  const overlap = options.chunkOverlap ?? 100;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!normalized) return [];
  if (normalized.length <= chunkSize) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length);

    if (end < normalized.length) {
      // Look back for a natural boundary within the last ~20% of the window.
      const windowStart = Math.max(start + Math.floor(chunkSize * 0.8), start + 1);
      const slice = normalized.slice(windowStart, end);
      const breakers = ['\n\n', '\n', '. ', '! ', '? ', '; '];
      let bestBreak = -1;
      for (const b of breakers) {
        const idx = slice.lastIndexOf(b);
        if (idx !== -1) {
          bestBreak = windowStart + idx + b.length;
          break;
        }
      }
      if (bestBreak > start) end = bestBreak;
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

/** Full pipeline: extract + chunk + metadata. */
export async function processDocument(
  buffer: Buffer,
  docType: SupportedDocType,
  options: ChunkingOptions = {}
): Promise<ProcessedDocument> {
  const extraction = await extractText(buffer, docType);
  const chunks = chunkText(extraction.text, options);
  return {
    ...extraction,
    chunks,
    chunkCount: chunks.length,
  };
}

// ---------------------------------------------------------------------------
// Filename safety
// ---------------------------------------------------------------------------

/**
 * Produce a safe display name: strips path components and dangerous chars to
 * prevent path traversal / header injection. The on-disk name is always a UUID
 * generated by the caller — this is purely for display.
 */
export function safeDisplayName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, ''); // drop any path
  return base
    .replace(/[\x00-\x1f<>:"|?*]/g, '') // control + reserved chars
    .replace(/\.{2,}/g, '.') // collapse traversal dots
    .slice(0, 255)
    .trim() || 'untitled';
}
