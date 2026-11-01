/** Safe acquisition receipt: no query strings, coordinates or subject identities. */
export type ParcelRequestTelemetry = {
  provider: 'census' | 'arcgis'; service: string; httpStatus: number | null;
  latencyMs: number; requestedAt: string; outcome: 'SUCCESS' | 'HTTP_ERROR' | 'TRANSPORT_ERROR' | 'INVALID_RESPONSE';
  reportId?: string; requestId?: string; origin?: string;
};
export type ParcelTrace = Pick<ParcelRequestTelemetry, 'reportId' | 'requestId' | 'origin'>;
export function parcelTelemetryObserver(target: ParcelRequestTelemetry[], trace: ParcelTrace = {}) {
  return (entry: ParcelRequestTelemetry) => { target.push({ ...entry, ...trace }); };
}
