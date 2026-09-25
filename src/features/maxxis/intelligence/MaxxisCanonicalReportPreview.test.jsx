import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MaxxisCanonicalReportPreview } from './MaxxisCanonicalReportPreview';

describe('canonical report preview', () => {
  it('keeps the modal generic while rendering chat data through the real PDF engine', () => {
    const source = readFileSync(new URL('./MaxxisCanonicalReportPreview.jsx', import.meta.url), 'utf8');
    expect(source).toContain('renderMaxxisReportPdfCached({');
    expect(source).toContain("import('pdfjs-dist/legacy/build/pdf.mjs')");
    expect(source).toContain('schema,');
    expect(source).not.toMatch(/report-previews\/.+\.png/);
  });

  it('exposes the paid report preview entry without duplicating export actions', () => {
    const html = renderToStaticMarkup(<MaxxisCanonicalReportPreview
      schema={{ type: 'maxxis_report_schema', reportType: 'DEAL_INTELLIGENCE', pages: Array.from({ length: 6 }) }}
      language="pt"
    />);
    expect(html).toContain('Abrir experiência do relatório do investidor');
    expect(html).toContain('LEVEL 3');
    expect(html).not.toMatch(/Gerar PDF|Enviar por email|Compartilhar/);
  });

  it('renders every PDF page in one vertical flow without carousel controls', () => {
    const source = readFileSync(new URL('./MaxxisCanonicalReportPreview.jsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('./MaxxisCanonicalReportPreview.css', import.meta.url), 'utf8');
    expect(source).toContain('Array.from({ length: total }');
    expect(source).toContain('<CanonicalPdfPage');
    expect(source).not.toMatch(/move\(-1\)|move\(1\)|is-previous|is-next/);
    expect(css).toMatch(/\.maxxis-canonical-pages\s*\{[^}]*display:\s*grid/);
    expect(css).not.toContain('.maxxis-canonical-arrow');
  });

  it('does not restart rendering when the parent recreates an equivalent entitlement object', () => {
    const source = readFileSync(new URL('./MaxxisCanonicalReportPreview.jsx', import.meta.url), 'utf8');
    expect(source).toContain('const pdfEntitlementKey = [');
    expect(source).toContain('const pdfEntitlementRef = useRef(pdfEntitlement)');
    expect(source).toContain('[activated, schema, pdfEntitlementKey, generatedAt, language]');
    expect(source).not.toContain('[activated, schema, exportEntitlements.PDF, generatedAt, language]');
  });
});
