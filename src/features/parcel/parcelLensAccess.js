import { shouldHideStreetAddressOnCard } from '../../lib/propertyAddressPrivacy';
import { validPoint } from '../../../supabase/functions/_shared/public-parcel/geometry.ts';

// Availability is independent of Match/payment state and of an async GIS result.
// Address privacy and the server-resolved feature gate remain authoritative.
export function propertyParcelContext(property, enabled, point = { lat: property?.lat, lng: property?.lng }) {
  if (enabled !== true || shouldHideStreetAddressOnCard(property) || !validPoint(point)) return null;
  const itemId = String(property?.id ?? '').trim();
  return itemId ? { itemId, point } : null;
}

// Reuse the original validated inventory point, not a coincident-PIN display
// offset or a second, narrower interpretation of latitude/longitude aliases.
export function parcelContextForPin(itemId, property, pinIndex, enabled) {
  const id=String(itemId??'').trim();const pin=pinIndex.get(id);
  if(pin?.properties?.itemType!=='property'||pin.geometry?.type!=='Point')return null;
  const [lng,lat]=pin.geometry.coordinates||[];
  return propertyParcelContext({...property,id},enabled,{lat,lng});
}
