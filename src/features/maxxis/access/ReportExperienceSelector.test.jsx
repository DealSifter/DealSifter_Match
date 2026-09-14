import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReportExperienceSelector } from './ReportExperienceSelector';

describe('Report Experience Selector', () => {
  it('renders three neutral intelligence levels with preview controls', () => {
    const html = renderToStaticMarkup(<ReportExperienceSelector plan="free" language="en" />);
    expect(html).toContain('BASIC PROPERTY RELEASE');
    expect(html).toContain('MAXXIS AI ANALYSIS');
    expect(html).toContain('DEAL INTELLIGENCE REPORT');
    expect(html).toContain('3 Nuggets');
    expect(html).toContain('5 Nuggets');
    expect(html).toContain('Preview report');
    expect(html).not.toContain('is-selected');
    expect(html).not.toMatch(/icon-(?:crown|diamond|lock|star)|data-icon="(?:crown|diamond|lock|star)"/i);
  });

  it('uses official Maxxis assets and performs no entitlement mutation itself', () => {
    const onSelect = vi.fn();
    const html = renderToStaticMarkup(<ReportExperienceSelector plan="enterprise" onSelect={onSelect} />);
    expect(html).toContain('avatar-idle');
    expect(html).toContain('avatar-observing');
    expect(html.match(/Included/g)).toHaveLength(3);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('exposes mobile vertical layout and enlarged previews', () => {
    const css = readFileSync(new URL('./ReportExperienceSelector.css', import.meta.url), 'utf8');
    expect(css).toMatch(/max-width:767px/);
    expect(css).toMatch(/\.report-level-grid\s*\{\s*grid-template-columns:1fr/);
    expect(css).toContain('min-height:170px');
  });
});
