import { describe, expect, it } from 'vitest';
import { normalizeReportEmailRecipients, updateReportEmailRecipient } from './MatchesPortfolio';

describe('report email recipient isolation', () => {
  it('keeps the profile fallback exclusively in To', () => {
    expect(normalizeReportEmailRecipients(null, 'owner@example.com')).toEqual({
      to: 'owner@example.com',
      cc: '',
      bcc: '',
    });
  });

  it('removes legacy defaults that copied To into Cc and Bcc', () => {
    expect(normalizeReportEmailRecipients({
      to: 'owner@example.com',
      cc: ' OWNER@example.com ',
      bcc: 'owner@example.com',
    })).toEqual({
      to: 'owner@example.com',
      cc: '',
      bcc: '',
    });
  });

  it('preserves three genuinely independent recipients', () => {
    expect(normalizeReportEmailRecipients({
      to: 'to@example.com',
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
    })).toEqual({
      to: 'to@example.com',
      cc: 'cc@example.com',
      bcc: 'bcc@example.com',
    });
  });

  it('changes only To when the user types in the first field', () => {
    const before = { to: '', cc: '', bcc: '' };
    expect(updateReportEmailRecipient(before, 'to', 'first@example.com')).toEqual({
      to: 'first@example.com',
      cc: '',
      bcc: '',
    });
    expect(before).toEqual({ to: '', cc: '', bcc: '' });
  });

  it('changes Cc and Bcc independently without copying To', () => {
    const withTo = { to: 'first@example.com', cc: '', bcc: '' };
    const withCc = updateReportEmailRecipient(withTo, 'cc', 'copy@example.com');
    const withBcc = updateReportEmailRecipient(withCc, 'bcc', 'hidden@example.com');
    expect(withBcc).toEqual({
      to: 'first@example.com',
      cc: 'copy@example.com',
      bcc: 'hidden@example.com',
    });
  });
});
