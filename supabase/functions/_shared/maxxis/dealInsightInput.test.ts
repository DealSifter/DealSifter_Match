import { assertEquals, assertThrows } from 'jsr:@std/assert@1';
import { resolveDealInsightInput } from './dealInsightInput.ts';

const PROPERTY_ID = '588e34cf-bd85-4bb1-88f1-64a1cfa985ea';
const OTHER_ID = '07343e87-1ef8-4ca5-a88e-be49d95431a7';

Deno.test('canonical deal insight accepts a trusted report type without passing it to property detail validator', () => {
  assertEquals(resolveDealInsightInput({ propertyId: PROPERTY_ID, reportType: 'DEAL_INTELLIGENCE' }, PROPERTY_ID), {
    propertyId: PROPERTY_ID, reportType: 'DEAL_INTELLIGENCE',
  });
  assertEquals(resolveDealInsightInput({ propertyId: PROPERTY_ID }, PROPERTY_ID), {
    propertyId: PROPERTY_ID, reportType: '',
  });
});

Deno.test('canonical deal insight rejects unknown fields, report types, and mismatched context', () => {
  assertThrows(() => resolveDealInsightInput({ propertyId: PROPERTY_ID, reportType: 'DEAL_INTELLIGENCE', sql: 'x' }, PROPERTY_ID), Error, 'INVALID_DEAL_INSIGHT_INPUT');
  assertThrows(() => resolveDealInsightInput({ propertyId: PROPERTY_ID, reportType: 'OTHER' }, PROPERTY_ID), Error, 'INVALID_DEAL_INSIGHT_INPUT');
  assertThrows(() => resolveDealInsightInput({ propertyId: OTHER_ID, reportType: 'MAXXIS_ANALYSIS' }, PROPERTY_ID), Error, 'PROPERTY_CONTEXT_MISMATCH');
});
