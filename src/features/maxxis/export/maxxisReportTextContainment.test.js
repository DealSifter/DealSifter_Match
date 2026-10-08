import { describe, expect, it } from 'vitest';
import { createCardGeometry, renderContainedText } from './maxxisReportPdf';
import { REPORT_BODY_TIERS, REPORT_TEXT_POLICIES } from './maxxisReportVisualPolicy';

function fakeDoc() {
  let fontSize = REPORT_BODY_TIERS.default;
  const doc = {
    __maxxisLayoutAudit: { lines: [], sections: [] },
    setFont: () => doc,
    setTextColor: () => doc,
    setFontSize: (size) => { fontSize = size; return doc; },
    getLineHeight: () => fontSize + 3,
    getTextWidth: (text) => String(text || '').length * fontSize * 0.48,
    splitTextToSize: (text, width) => {
      const words = String(text || '').split(/\s+/).filter(Boolean);
      const lines = [];
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && doc.getTextWidth(candidate) > width) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) lines.push(current);
      return lines.length ? lines : [''];
    },
    saveGraphicsState: () => doc,
    restoreGraphicsState: () => doc,
    rect: () => doc,
    clip: () => doc,
    discardPath: () => doc,
    text: () => doc,
    getCurrentPageInfo: () => ({ pageNumber: 6 }),
  };
  return doc;
}

const card = createCardGeometry({ x: 30, y: 467, width: 260, height: 133, titleHeight: 34 });
const bounds = { x: card.contentX, y: card.contentY, width: card.contentWidth, height: card.contentHeight };
const cardBounds = { x: card.x, y: card.y, width: card.width, height: card.height };

describe('Maxxis absolute PDF text containment engine', () => {
  it('uses the default body font when short text fits', () => {
    const doc = fakeDoc();
    const result = renderContainedText({ doc, text: 'Conclusão curta e objetiva.', bounds, cardBounds, policy: REPORT_TEXT_POLICIES.page6ProfileConclusion, sectionId: 'page6ProfileConclusion', locale: 'pt' });
    expect(result.selectedFontSize).toBe(REPORT_BODY_TIERS.default);
    expect(result.contentReduced).toBe(false);
  });

  it('never draws body text below the nine point minimum', () => {
    const doc = fakeDoc();
    const long = Array.from({ length: 40 }, (_, index) => `Frase ${index + 1} com evidência decisória e ação verificável.`).join(' ');
    const result = renderContainedText({ doc, text: long, bounds, cardBounds, policy: REPORT_TEXT_POLICIES.page6ProfileConclusion, sectionId: 'page6ProfileConclusion', locale: 'pt' });
    expect(result.selectedFontSize).toBeGreaterThanOrEqual(REPORT_BODY_TIERS.minimum);
  });

  it('keeps every final audited line inside content bounds', () => {
    const doc = fakeDoc();
    renderContainedText({ doc, text: 'Preço, condição, evidências comparáveis e próxima verificação devem permanecer dentro do card.', bounds, cardBounds, policy: REPORT_TEXT_POLICIES.page6OpenQuestions, sectionId: 'page6OpenQuestions', locale: 'pt' });
    expect(doc.__maxxisLayoutAudit.lines.length).toBeGreaterThan(0);
    for (const line of doc.__maxxisLayoutAudit.lines) {
      expect(line.x).toBeGreaterThanOrEqual(line.contentBounds.x);
      expect(line.bottomY).toBeLessThanOrEqual(line.contentBounds.bottom);
      expect(line.overflowX).toBe(0);
      expect(line.overflowY).toBe(0);
    }
  });

  it('breaks very long tokens instead of allowing horizontal overflow', () => {
    const doc = fakeDoc();
    renderContainedText({ doc, text: 'responsabilidadefinanciamentocompatibilidade'.repeat(3), bounds, cardBounds, policy: REPORT_TEXT_POLICIES.page6MainTopics, sectionId: 'page6MainTopics', locale: 'pt' });
    expect(doc.__maxxisLayoutAudit.lines.every((line) => line.x + line.width <= line.contentBounds.right)).toBe(true);
  });
});
