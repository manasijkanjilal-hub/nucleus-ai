/**
 * Local filesystem storage for uploaded documents.
 *
 * Files are stored under DOCUMENT_STORAGE_DIR using UUID-based names so the
 * original (user-controlled) filename never touches the filesystem path —
 * preventing path-traversal and collisions. Swapping this module for S3 later
 * only requires re-implementing these four functions.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export const STORAGE_DIR =
  process.env.DOCUMENT_STORAGE_DIR ||
  path.join(process.cwd(), '.uploads');

const FILES_DIR = path.join(STORAGE_DIR, 'files');

async function ensureDir() {
  await fs.mkdir(FILES_DIR, { recursive: true });
}

const EXT_BY_TYPE: Record<string, string> = {
  PDF: '.pdf',
  DOCX: '.docx',
  TXT: '.txt',
};

/** Persist a buffer and return the relative stored file name + absolute path. */
export async function saveFile(
  buffer: Buffer,
  docType: 'PDF' | 'DOCX' | 'TXT'
): Promise<{ storedName: string; filePath: string }> {
  await ensureDir();
  const storedName = `${randomUUID()}${EXT_BY_TYPE[docType] ?? ''}`;
  const filePath = path.join(FILES_DIR, storedName);
  await fs.writeFile(filePath, buffer);
  return { storedName, filePath };
}

/** Read a stored file back into a Buffer. */
export async function readFile(filePath: string): Promise<Buffer> {
  return fs.readFile(filePath);
}

/** Delete a stored file (best-effort; never throws). */
export async function deleteFile(filePath: string | null | undefined): Promise<void> {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    /* already gone */
  }
}
