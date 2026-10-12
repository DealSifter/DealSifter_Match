# Jefferson County AL / Gable investigation

Checked 2026-10-12, FIPS 01073. No access-control bypass, credentials, forged referers, token acquisition, rotating IPs, scraped commercial datasets or paid services.

## Six official discovery entrypoints

1. [County Enterprise GIS](https://www.jccal.org/484/Enterprise-GIS): links parcel viewer, zoning viewer and official open-data portal.
2. [County open-data portal](https://data-jeffco-al.opendata.arcgis.com/) and verified publisher `JeffersonCountyALgis`: 13 parcel-search catalog matches. The two parcel service items 02545b1e80ef45b4a39be8bc12cd43fa and ac6ec7f4f83d4715a45acc8990b8b8c8 reference the **same** jccgis MapServer, not separate fallbacks. Unrelated municipality layers are not parcel sources.
3. Current [official parcel lookup](https://experience.arcgis.com/experience/222c0369492646b48ccd25bbe8b2553e): public app configuration reachable; no distinct usable hosted parcel service identified.
4. Legacy [official parcel app](https://jeffco-al.maps.arcgis.com/apps/View/index.html?appid=b5118cb926c64ebeac59c8d0b01f6e45): public configuration reachable; does not establish an independent approved backend.
5. [Board of Equalization](https://www.jccal.org/207/Board-of-Equalization) / [official CAPture tax portal](https://eringcapture.jccal.org/): CAPture root returns 403 from this runtime. No generic approved machine-query geometry API established; no one-off HTML tax parsing implemented.
6. [Alabama Revenue county offices](https://www.revenue.alabama.gov/property-tax/county-offices-appraisal-assessment-records/) / statewide GIS discovery: Revenue directs Jefferson users to the same county resources; gis.alabama.gov connection failed. No alternative approved statewide Jefferson parcel or generic WFS service was established.

These are **six entrypoints, not six independent polygon datasets**. No official alternative with demonstrably usable geometry and sufficient terms was found within these bounded searches. This is not proof that no other public source exists.

## Original 403 diagnosis

Both `/server/rest/services/Basemap/Parcels/MapServer/0?f=json` and `/server/rest/info?f=json` return **HTTP 403 HTML** containing `_Incapsula_Resource`. That is an Imperva/Incapsula edge-gateway response, not an ArcGIS JSON token-required error (498/499). This makes a layer-only permission error unlikely, because the public server-info path is blocked too.

Observable cause: **edge/WAF denies requests from this runtime**. The precise configured rule (IP reputation, client policy or another WAF rule) is **UNDETERMINED** without county confirmation. No false certainty about IP filtering, referer restrictions, service deprecation or a need for a token is claimed. Operational classification: **UNUSABLE_PUBLIC_RUNTIME** for current integration; registry retains explicit technical and license reasons and remains inactive.

## Candidate capabilities

The official parcel catalog describes Polygon geometry and APN/owner/assessor/GIS acreage/legal/subdivision fields. Backend 403 prevents revalidation of that schema and Gable point/APN/viewport today. Owner, assessment, tax, zoning, acreage and last update are **not established for Gable**. Published nightly freshness policy is not an observed update timestamp. The CAPture portal is an assessment/tax candidate, not a validated geometry source. No candidate is activated simply because a public web viewer exists.

## Gable comparison

Existing stored location: 33.6528268892837, -86.664736200637. Existing publisher lot: `1,14ac` (1.14 acres). Existing RentCast cache artifact: 23,854 sqft (~0.547612 acres); **no new RentCast request**. Public GIS area/APN/geometry remain unavailable, so no three-source agreement cluster can be claimed. The publisher/provider conflict is diagnostic only, with canonical facts, reports and Maxxis unchanged.

Evidence: `phase1b-discovery.json`, `phase1b-official-review.json`, `phase1b-source-inspection.json`, `gable-source-comparison.json`. No Jefferson-specific adapter was warranted by a real approved alternate technology.
