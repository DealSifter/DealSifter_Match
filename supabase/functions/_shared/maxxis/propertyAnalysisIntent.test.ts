import { asksForSelectedPropertyAnalysis } from './propertyAnalysisIntent.ts';

Deno.test('routes factual selected-property analysis to the canonical context', () => {
  if (!asksForSelectedPropertyAnalysis('Analyze the selected property and its risks')) throw new Error('English selected property was not recognized');
  if (!asksForSelectedPropertyAnalysis('Analise os riscos deste imóvel')) throw new Error('Portuguese selected property was not recognized');
  if (!asksForSelectedPropertyAnalysis('Analizar esta propiedad y los riesgos')) throw new Error('Spanish selected property was not recognized');
});

Deno.test('does not convert a generic inventory question into property analysis', () => {
  if (asksForSelectedPropertyAnalysis('Which opportunities are available in Texas?')) throw new Error('Inventory search was misclassified');
  if (asksForSelectedPropertyAnalysis('How does the app work?')) throw new Error('Generic question was misclassified');
});
