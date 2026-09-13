import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { resolveExportPopupFlow } from '../../../domain/intelligenceAccess';
import { IntelligenceAnalysisChooser } from './IntelligenceAnalysisChooser';

describe('Intelligence Analysis chooser', () => {
  it('shows both Free unlock paths without inventing a Nugget price', () => {
    const flow = resolveExportPopupFlow({ plan: 'free' });
    const html = renderToStaticMarkup(<IntelligenceAnalysisChooser options={flow.analysisOptions} language="en" />);
    expect(html).toContain('Professional Analysis');
    expect(html).toContain('Enterprise Deal Intelligence');
    expect(html).toContain('Nugget price pending configuration');
    expect(html).not.toMatch(/·\s*[1-9][0-9]*/);
  });

  it('exposes a controlled intent callback and performs no purchase itself', () => {
    const onRequestUnlock = vi.fn();
    const flow = resolveExportPopupFlow({ plan: 'free' });
    const html = renderToStaticMarkup(
      <IntelligenceAnalysisChooser options={flow.analysisOptions} onRequestUnlock={onRequestUnlock} />,
    );
    expect(html).toContain('data-access-state="NUGGET_UNLOCK_REQUIRED"');
    expect(onRequestUnlock).not.toHaveBeenCalled();
  });
});
