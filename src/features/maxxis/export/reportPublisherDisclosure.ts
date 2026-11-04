const selections = new WeakMap<object, boolean>();
export function canIncludeReportPublisher(schema: any): boolean {
  // allowedContacts is supplied only by the existing authorized contact projection.
  return !!schema && Array.isArray(schema.sections?.propertySummary?.data?.owner?.allowedContacts)
    && schema.sections.propertySummary.data.owner.allowedContacts.length > 0;
}
export function setReportPublisherDisclosure(schema: object, include: boolean) {
  selections.set(schema, include === true && canIncludeReportPublisher(schema));
}
export function getReportPublisherDisclosure(schema: object, explicit?: boolean): boolean {
  if (!schema) return false;
  const selected = selections.get(schema);
  const completeReport = (schema as { reportType?: string }).reportType === 'DEAL_INTELLIGENCE';
  return canIncludeReportPublisher(schema) && (explicit === undefined ? selected ?? completeReport : explicit === true);
}
