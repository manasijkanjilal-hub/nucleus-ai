/**
 * Integration test for the Context Vault processing pipeline primitives.
 *
 * Runs without a test framework (zero-config) via `tsx`:
 *     npx tsx src/lib/__tests__/context-vault.test.ts
 *
 * Covers: file validation (magic bytes), text chunking, embedding generation
 * (deterministic fallback) and the in-memory vector store (upsert / search /
 * delete / brand filtering). Forces the in-memory vector backend so no external
 * services are required.
 */

// Force the in-memory vector store fallback for a hermetic test run.
process.env.QDRANT_URL = '';
process.env.OPENAI_API_KEY = '';
process.env.DOCUMENT_STORAGE_DIR = '/tmp/nucleus-vault-test';

import assert from 'node:assert';
import {
  validateFile,
  detectTypeFromBytes,
  chunkText,
  safeDisplayName,
} from '../document-processor';
import {
  generateEmbeddings,
  generateEmbedding,
  fallbackEmbedding,
  VECTOR_DIMENSION,
} from '../embeddings';
import {
  upsertVectors,
  searchVectors,
  deleteVectorsByDocument,
  countVectorsByDocument,
  getVectorStoreBackend,
} from '../vector-store';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${err?.message ?? err}`);
  }
}

async function main() {
  console.log('\nContext Vault — pipeline integration tests\n');

  // --- File validation -----------------------------------------------------
  await test('detectTypeFromBytes identifies PDF magic bytes', () => {
    assert.equal(detectTypeFromBytes(Buffer.from('%PDF-1.7\n...')), 'PDF');
  });
  await test('detectTypeFromBytes identifies DOCX (zip) magic bytes', () => {
    assert.equal(
      detectTypeFromBytes(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00])),
      'DOCX'
    );
  });
  await test('detectTypeFromBytes treats plain text as TXT', () => {
    assert.equal(detectTypeFromBytes(Buffer.from('hello world')), 'TXT');
  });
  await test('validateFile rejects an oversized file', () => {
    const big = Buffer.alloc(11 * 1024 * 1024, 0x61);
    const r = validateFile({
      fileName: 'big.txt',
      mimeType: 'text/plain',
      size: big.length,
      buffer: big,
    });
    assert.equal(r.valid, false);
    assert.match(r.error ?? '', /limit/i);
  });
  await test('validateFile rejects content/extension mismatch (exe as pdf)', () => {
    const fake = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // "MZ" executable header
    const r = validateFile({
      fileName: 'malware.pdf',
      mimeType: 'application/pdf',
      size: fake.length,
      buffer: fake,
    });
    assert.equal(r.valid, false);
  });
  await test('validateFile accepts a valid PDF', () => {
    const pdf = Buffer.from('%PDF-1.4\n%âãÏÓ\n');
    const r = validateFile({
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
      size: pdf.length,
      buffer: pdf,
    });
    assert.equal(r.valid, true);
    assert.equal(r.docType, 'PDF');
  });

  // --- Filename safety ------------------------------------------------------
  await test('safeDisplayName strips path traversal', () => {
    assert.equal(safeDisplayName('../../etc/passwd'), 'passwd');
    assert.equal(safeDisplayName('a/b/c/report.pdf'), 'report.pdf');
  });

  // --- Chunking -------------------------------------------------------------
  await test('chunkText returns single chunk for short text', () => {
    const chunks = chunkText('A short sentence.');
    assert.equal(chunks.length, 1);
  });
  await test('chunkText splits long text with overlap', () => {
    const para = 'Sentence number ' + 'word '.repeat(50) + '. ';
    const long = para.repeat(20);
    const chunks = chunkText(long, { chunkSize: 500, chunkOverlap: 100 });
    assert.ok(chunks.length > 1, 'expected multiple chunks');
    chunks.forEach((c) => assert.ok(c.length <= 700, 'chunk within bounds'));
  });

  // --- Embeddings -----------------------------------------------------------
  await test('fallbackEmbedding produces a normalized vector of correct dim', () => {
    const v = fallbackEmbedding('brand voice guidelines');
    assert.equal(v.length, VECTOR_DIMENSION);
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    assert.ok(Math.abs(norm - 1) < 1e-6, `expected unit norm, got ${norm}`);
  });
  await test('fallbackEmbedding is deterministic', () => {
    const a = fallbackEmbedding('same input');
    const b = fallbackEmbedding('same input');
    assert.deepEqual(a, b);
  });
  await test('generateEmbeddings batches and reports fallback usage', async () => {
    const { embeddings, usage } = await generateEmbeddings(['one', 'two', 'three']);
    assert.equal(embeddings.length, 3);
    assert.equal(usage.usedFallback, true);
    assert.equal(usage.inputCount, 3);
  });

  // --- Vector store (in-memory) --------------------------------------------
  await test('vector store reports memory backend when Qdrant disabled', async () => {
    assert.equal(await getVectorStoreBackend(), 'memory');
  });

  const docA = 'test-doc-a';
  const docB = 'test-doc-b';
  await test('upsert + search returns the most relevant chunk', async () => {
    await deleteVectorsByDocument(docA);
    await deleteVectorsByDocument(docB);
    const texts = [
      'Our brand voice is confident and friendly.',
      'Pricing tiers start at twenty dollars per month.',
      'The product integrates with marketing automation tools.',
    ];
    const { embeddings } = await generateEmbeddings(texts);
    await upsertVectors(
      texts.map((t, i) => ({
        id: `${docA}-${i}`,
        vector: embeddings[i],
        payload: { documentId: docA, brandId: 'brand-1', chunkIndex: i, originalText: t },
      }))
    );
    const q = await generateEmbedding('brand voice confident friendly');
    const hits = await searchVectors(q, { limit: 3 });
    assert.ok(hits.length >= 1);
    assert.match(hits[0].payload.originalText, /brand voice/i);
  });
  await test('search respects brand filtering', async () => {
    const { embeddings } = await generateEmbeddings(['unrelated content for brand two']);
    await upsertVectors([
      {
        id: `${docB}-0`,
        vector: embeddings[0],
        payload: { documentId: docB, brandId: 'brand-2', chunkIndex: 0, originalText: 'brand two content' },
      },
    ]);
    const q = await generateEmbedding('content');
    const brand1 = await searchVectors(q, { brandId: 'brand-1', limit: 10 });
    assert.ok(brand1.every((h) => h.payload.brandId === 'brand-1'));
    const brand2 = await searchVectors(q, { brandId: 'brand-2', limit: 10 });
    assert.ok(brand2.every((h) => h.payload.brandId === 'brand-2'));
  });
  await test('countVectorsByDocument + delete cleans up', async () => {
    assert.equal(await countVectorsByDocument(docA), 3);
    await deleteVectorsByDocument(docA);
    assert.equal(await countVectorsByDocument(docA), 0);
    await deleteVectorsByDocument(docB);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main();
