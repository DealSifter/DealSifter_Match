// Opaque, user-owned, in-memory acquisition handoff. Never a fact or an authority
// on the client; Maxxis verifies the signed evidence against its authorized subject.
let owner = '';
const receipts = new Map();
export function rememberParcelEvidenceReceipt(userId, propertyId, token) {
  const nextOwner = String(userId || '');
  if (owner !== nextOwner) { receipts.clear(); owner = nextOwner; }
  if (!owner || !propertyId || typeof token !== 'string' || token.length > 20100) return;
  const changed=receipts.get(String(propertyId))!==token;
  receipts.set(String(propertyId), token);
  if(changed&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('ds:parcel-evidence-ready',{detail:{userId:owner,propertyId:String(propertyId)}}));
  while (receipts.size > 8) receipts.delete(receipts.keys().next().value);
}
export function cachedParcelEvidenceReceipt(userId, propertyId) {
  if (owner !== String(userId || '')) { receipts.clear(); owner = String(userId || ''); }
  return receipts.get(String(propertyId)) || null;
}
