export const catIcon = (id) => {
  const map = {
    all: 'grid', wholesaler: 'house', investor: 'trendUp', lender: 'bank',
    seller: 'key', buyer: 'home2', ff: 'tool', ff_gc: 'tool', ff_rehab: 'layers',
    services: 'services', svc_d4d: 'search', svc_photo: 'camera', svc_survey: 'ruler',
    svc_drone: 'camera', svc_inspection: 'check', svc_title: 'doc', svc_accountant: 'wallet', svc_notary: 'pen', svc_va: 'user',
    tax: 'doc', attorney: 'balance', auction: 'bell', auction_consultancy: 'briefcase', auction_advisory: 'trendUp',
  };
  return map[id] || 'grid';
};
