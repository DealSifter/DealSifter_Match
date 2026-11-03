// Explicit release configuration, not live discovery. Partial parcel coverage.
// Evidence: qa/gis-priority-expansion-release/LIVE_RESULTS.json and MA_POINT_RESULTS.json.
export const PRIORITY_NC_COUNTIES = [
  '37183','37101','37081','37067','37179','37021',
  '37001','37003','37005','37007','37011','37013','37017','37019','37023','37029','37031','37037','37039','37043','37045','37049','37053','37059','37061','37065','37069','37071','37077','37083','37087','37089','37093','37095','37097','37099','37103','37105','37109','37111','37115','37117','37121','37123','37125','37127','37131','37133','37139','37143','37145','37147','37149','37151','37153','37157','37161','37163','37165','37169','37171','37187','37189','37191','37195','37197','37199',
] as const;
// New MA scope supports point and neighborhood operations only. The original
// Middlesex/Suffolk source and its capabilities remain untouched. Statewide
// LOC_ID searches exceeded the existing timeout; do not advertise APN support.
export const PRIORITY_MA_POINT_COUNTIES = ['25001','25003','25005','25007','25011','25013','25019','25021','25023','25027'] as const;
