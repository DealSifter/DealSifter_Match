import { isMatchingReportExportEntitlement } from './reportExportEntitlement';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value) => String(value || '').trim();

export function createReportEmailRequest({ recipient, subject, reportType, propertyId, message = '', ownerId, requesterId, exportEntitlement } = {}) {
  const normalized = { recipient: text(recipient).toLowerCase(), subject: text(subject), reportType: text(reportType).toUpperCase(), propertyId: text(propertyId), message: text(message), ownerId: text(ownerId), requesterId: text(requesterId) };
  if (!emailPattern.test(normalized.recipient) || !normalized.subject || !normalized.propertyId || !normalized.ownerId
    || normalized.ownerId !== normalized.requesterId
    || !isMatchingReportExportEntitlement(exportEntitlement, normalized.reportType, 'EMAIL')) return null;
  return Object.freeze({ type: 'report_email_request', ...normalized, status: 'PREPARED_NOT_SENT', attachment: null, deliveryId: null });
}

export function createSharedReport({ id, reportType, ownerId, requesterId, createdAt, expiresAt, accessLevel, exportEntitlement } = {}) {
  const normalized = { id: text(id), reportType: text(reportType).toUpperCase(), ownerId: text(ownerId), requesterId: text(requesterId) };
  const created = new Date(createdAt);
  const expires = new Date(expiresAt);
  if (!normalized.id || !normalized.ownerId || normalized.ownerId !== normalized.requesterId
    || Number.isNaN(created.getTime()) || Number.isNaN(expires.getTime()) || expires <= created
    || !isMatchingReportExportEntitlement(exportEntitlement, normalized.reportType, 'SHARE')) return null;
  return Object.freeze({ type: 'shared_report', id: normalized.id, reportType: normalized.reportType, ownerId: normalized.ownerId,
    createdAt: created.toISOString(), expiresAt: expires.toISOString(), accessLevel: text(exportEntitlement.accessLevel || accessLevel).toUpperCase(),
    status: 'PREPARED_NOT_PUBLISHED', url: null, token: null, reportData: null });
}
