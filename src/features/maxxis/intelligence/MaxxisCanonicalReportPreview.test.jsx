import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MaxxisCanonicalReportPreview } from './MaxxisCanonicalReportPreview';

describe('canonical report preview', () => {
  it('keeps the modal generic while rendering chat data through the real PDF engine', () => {
    const source = readFileSync(new URL('./MaxxisCanonicalReportPreview.jsx', import.meta.url), 'utf8');
    expect(source).toContain('renderMaxxisReportPdf({');
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
});
