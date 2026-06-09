import { C } from "../theme/colors";

export const CATEGORIES = [
  { id:"all",        label:"All",           sub:null },
  { id:"wholesaler", label:"Wholesaler",    sub:null },
  { id:"investor",   label:"RE Investor",   sub:null },
  { id:"lender",     label:"Lender",        sub:null },
  { id:"seller",     label:"Owner",         sub:null },
  { id:"buyer",      label:"Cash Buyer",    sub:null },
  { id:"ff",         label:"Fix & Flip",    sub:[
    { id:"ff_gc",    label:"General Contractor" },
    { id:"ff_rehab", label:"Rehab Staff" },
  ]},
  { id:"services",   label:"Services",      sub:[
    { id:"svc_d4d",    label:"Drive4$" },
    { id:"svc_photo",  label:"Photography" },
    { id:"svc_drone",  label:"Drone Image" },
    { id:"svc_inspection", label:"Inspections" },
    { id:"svc_survey", label:"Survey" },
    { id:"svc_title",  label:"Title Company" },
    { id:"svc_accountant", label:"Accountant" },
    { id:"svc_notary", label:"Notary" },
    { id:"svc_va",     label:"Virtual Assistant" },
  ]},
  { id:"tax",        label:"Tax Deed / Tax Lien", sub:null },
  { id:"attorney",   label:"RE Attorney",   sub:null },
  { id:"auction",    label:"R.E Auctions",  sub:[
    { id:"auction_consultancy", label:"R.E Consultancy" },
    { id:"auction_advisory",    label:"R.E Advisory" },
  ]},
];

export const NUGGET_PACKS = [
  { id:"p5",   qty:5,   price:9,  bonus:0 },
  { id:"p15",  qty:15,  price:19, bonus:2,  popular:true },
  { id:"p40",  qty:40,  price:39, bonus:8 },
  { id:"p100", qty:100, price:79, bonus:25 },
];

export const PLANS = [
  { id:"free",       name:"Basic",        price:0,   nuggets:3,  firstMonthBonus:0,  color:C.t2,    limits:{ likesPerDay:5, activeMatches:3, unlockRequestsPerMonth:3, profile:"standard" }, features:["3 Gold Nuggets/month","5 likes/day","3 active matches","3 requests/month","Standard profile"] },
  { id:"pro",        name:"Professional", price:39,  nuggets:20, firstMonthBonus:3,  color:C.accent, limits:{ likesPerDay:null, activeMatches:10, unlockRequestsPerMonth:10, canExportUnlockedPdf:true, hasDealSifterChat:true, featuredProfileDiscountPct:20 }, features:["20 Gold Nuggets/month + 3 first month","Unlimited likes","10 unlock requests/month","10 active matches","Export unlocked properties as PDF","DealSifter chat","20% off Featured Profile"], popular:true },
  { id:"enterprise", name:"Enterprise",   price:129, nuggets:60, firstMonthBonus:20, color:C.gold,   limits:{ likesPerDay:null, activeMatches:null, unlockRequestsPerMonth:null, exclusiveContactsIncluded:2, featuredProfileIncluded:true }, features:["60 Gold Nuggets/month + 20 first month","Everything in Professional","Unlimited unlock requests and active matches","2 free exclusive contacts/month","Free Featured Profile"] },
];

export const EXCLUSIVE_CONTACT_RULE = {
  cost: 20,
  durationDays: 7,
  partialDiscountPct: 10,
};

export const FEATURED_PROFILE_RULE = {
  cost: 10,
  durationDays: 30,
};

export const VERIFIED_PROFILE_RULE = {
  cost: 0,
  requires: ["email", "phone"],
};

export const CITY_COORDS = {
  "Phoenix, AZ 85001": { lat: 33.4484, lng: -112.0740 },
  "Dallas, TX 75201": { lat: 32.7767, lng: -96.7970 },
  "Atlanta, GA 30303": { lat: 33.7490, lng: -84.3880 },
  "Los Angeles, CA 90012": { lat: 34.0522, lng: -118.2437 },
  "Las Vegas, NV 89101": { lat: 36.1699, lng: -115.1398 },
  "Miami, FL 33131": { lat: 25.7617, lng: -80.1918 },
  "Houston, TX 77002": { lat: 29.7604, lng: -95.3698 },
  "Denver, CO 80202": { lat: 39.7392, lng: -104.9903 },
  "Orlando, FL 32801": { lat: 28.5383, lng: -81.3792 },
  "Seattle, WA 98101": { lat: 47.6062, lng: -122.3321 },
  "San Diego, CA 92101": { lat: 32.7157, lng: -117.1611 },
  "Nashville, TN 37201": { lat: 36.1627, lng: -86.7816 },
  "Charlotte, NC 28202": { lat: 35.2271, lng: -80.8431 },
};

const PROPERTY_COORDS_BY_ID = {
  101: { lat: 33.4124, lng: -111.9770 },
  102: { lat: 33.4802, lng: -112.1539 },
  103: { lat: 32.7835, lng: -96.8071 },
  104: { lat: 33.8016, lng: -84.3601 },
  105: { lat: 34.0609, lng: -118.3050 },
  106: { lat: 33.5663, lng: -112.0832 },
  107: { lat: 32.8126, lng: -96.7878 },
  108: { lat: 36.1216, lng: -115.1739 },
  109: { lat: 29.7756, lng: -95.4285 },
  110: { lat: 39.7708, lng: -104.8965 },
  111: { lat: 25.7617, lng: -80.1918 },
  112: { lat: 34.0522, lng: -118.2437 },
  113: { lat: 33.4484, lng: -112.0740 },
  114: { lat: 32.7767, lng: -96.7970 },
  115: { lat: 33.7490, lng: -84.3880 },
  116: { lat: 36.1699, lng: -115.1398 },
  117: { lat: 47.6062, lng: -122.3321 },
  118: { lat: 32.7157, lng: -117.1611 },
  119: { lat: 39.7392, lng: -104.9903 },
  120: { lat: 29.7604, lng: -95.3698 },
  121: { lat: 36.1627, lng: -86.7816 },
  122: { lat: 35.2271, lng: -80.8431 },
  123: { lat: 28.5383, lng: -81.3792 },
  124: { lat: 33.4484, lng: -112.0740 },
  125: { lat: 34.0522, lng: -118.2437 },
  126: { lat: 25.7617, lng: -80.1918 },
  127: { lat: 32.7767, lng: -96.7970 },
  128: { lat: 39.7392, lng: -104.9903 },
  129: { lat: 33.7490, lng: -84.3880 },
  130: { lat: 36.1216, lng: -115.1739 },
};

export const CARDS = [
  { id:1, cat:"wholesaler", name:"Marcus Realty Group",  type:"Wholesaler",      loc:"Phoenix, AZ 85001",    deals:47,  badge:"Top Wholesaler",  desc:"Specializing in distressed SFR off-market deals across Maricopa County. We have over 15 years of experience in the Phoenix real estate market, focusing on identifying high-potential investment properties before they hit the MLS. Our network includes distressed sellers, bank REO departments, and estate liquidators. We close fast with proof of funds and can handle properties in any condition. Whether you're looking for fix-and-flip opportunities or buy-and-hold rentals, we deliver quality deals with solid profit margins. Average ROI on our deals is 18-25%. We also provide complete due diligence packages including comps, repair estimates, and after-repair values.",    tags:["Off-Market","SFR","Fast Close"],    verified:true,  rating:4.9, reviews:83,  phone:"(602) 555-0147", whatsapp:"+16025550147", email:"marcus@rgroup.com", photo:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80" },
  { id:2, cat:"lender",     name:"SunBelt Capital LLC",  type:"Lender",          loc:"Dallas, TX 75201",     deals:120, badge:"Hard Money",       desc:"Bridge & hard money loans up to $5M. 48hr approval.",               tags:["Hard Money","Bridge","Fix & Flip"], verified:true,  rating:4.7, reviews:211, phone:"(214) 555-0382", whatsapp:"+12145550382", email:"loans@sunbelt.com", photo:"https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80" },
  { id:3, cat:"ff",         name:"Iron Fox Renovations", type:"GC / Contractor", loc:"Atlanta, GA 30303",    deals:34,  badge:"Fix & Flip Pro",   desc:"Full gut rehabs and light cosmetics. Portfolio of 34 flips completed.", tags:["Rehab","Fix & Flip","Turnkey"],     verified:true,  rating:4.8, reviews:56,  phone:"(404) 555-0219", whatsapp:"+14045550219", email:"jobs@ironfox.io", photo:"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80" },
  { id:4, cat:"attorney",   name:"Olivia Chen, Esq.",    type:"RE Attorney",     loc:"Los Angeles, CA 90012",deals:200, badge:"Top Attorney",     desc:"Real estate closings, title disputes, LLC structuring & 1031 exchanges.",       tags:["Closings","1031","LLC"],            verified:true,  rating:5.0, reviews:142, phone:"(310) 555-0064", whatsapp:"+13105550064", email:"olivia@chenlaw.com", photo:"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80" },
  { id:5, cat:"auction",    name:"Desert Ridge Auctions",type:"Auction Buyer",   loc:"Las Vegas, NV 89101",  deals:88,  badge:"Auction Pro",      desc:"Actively buying courthouse steps & online auctions.",                   tags:["Auction","Cash","Courthouse"],      verified:false, rating:4.5, reviews:29,  phone:"(702) 555-0093", whatsapp:"+17025550093", email:"bids@desertridge.com", photo:"https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80" },
  { id:6, cat:"services",   name:"LensUp Media",         type:"Photography",     loc:"Miami, FL 33131",      deals:60,  badge:"RE Photographer",  desc:"Aerial drone + interior photography for listings.",         tags:["Drone","Listings","Media"],         verified:true,  rating:4.9, reviews:110, phone:"(305) 555-0211", whatsapp:"+13055550211", email:"hello@lensup.io", photo:"https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80" },
  { id:7, cat:"consulting",  name:"Apex RE Consulting",  type:"RE Consulting",   loc:"Austin, TX 78701",     deals:55,  badge:"Market Expert",    desc:"Feasibility studies and investment strategy.",       tags:["Strategy","Feasibility","ROI"],     verified:true,  rating:4.8, reviews:74,  phone:"(512) 555-0088", whatsapp:"+15125550088", email:"info@apexre.com", photo:"https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=150&q=80" },
  { id:8, cat:"services",   name:"ClearTitle Co.",       type:"Title Co.",       loc:"Houston, TX 77002",    deals:310, badge:"Trusted Title",    desc:"Fast, reliable title searches and insurance.",                          tags:["Title","Insurance","Closing"],      verified:true,  rating:4.7, reviews:198, phone:"(713) 555-0044", whatsapp:"+17135550044", email:"ops@cleartitle.com", photo:"https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=150&q=80" },
  { id:9, cat:"wholesaler", name:"Cash Kings TX",        type:"Wholesaler",      loc:"Houston, TX 77002",    deals:92,  badge:"High Volume",      desc:"Buying and selling 5-10 deals per month.",          tags:["Cash","High Volume","Retail"],      verified:true,  rating:4.8, reviews:176, phone:"(713) 555-0112", whatsapp:"+17135550112", email:"deals@cashkingstx.com", photo:"https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?auto=format&fit=crop&w=150&q=80" },
  { id:10, cat:"lender",    name:"Bridge Builders Finance", type:"Lender",        loc:"Denver, CO 80202",    deals:156, badge:"Fast Funding",    desc:"9% fix loans, 12mo terms. Asset-based underwriting.",      tags:["Bridge","Fix & Flip","Asset-Based"], verified:true,  rating:4.9, reviews:234, phone:"(303) 555-0276", whatsapp:"+13035550276", email:"loans@bridgebuilders.io", photo:"https://images.unsplash.com/photo-1554151228-14d9def656e4?auto=format&fit=crop&w=150&q=80" },
  { id:11, cat:"investor",  name:"Sarah Mitchell",         type:"RE Investor",    loc:"Orlando, FL 32801",   deals:68,  badge:"Multi-Unit Pro",  desc:"Focused on small multifamily and duplex investments.",         tags:["Multifamily","Duplex","Cash Buyer"], verified:true,  rating:4.8, reviews:95,  phone:"(407) 555-0198", whatsapp:"+14075550198", email:"sarah@smitchell.co", photo:"https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=150&q=80" },
  { id:12, cat:"buyer",     name:"Jason Park",             type:"Buyer",          loc:"Seattle, WA 98101",   deals:42,  badge:"Tech Investor",   desc:"Looking for turnkey rentals in growing tech markets.",          tags:["Turnkey","Tech Markets","SFR"],     verified:true,  rating:4.6, reviews:67,  phone:"(206) 555-0334", whatsapp:"+12065550334", email:"jpark@gmail.com", photo:"https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80" },
  { id:13, cat:"seller",    name:"Maria Rodriguez",        type:"Seller",         loc:"San Diego, CA 92101", deals:15,  badge:"Motivated Seller", desc:"Selling portfolio of 5 coastal properties.",                      tags:["Portfolio","Coastal","Motivated"],  verified:false, rating:4.3, reviews:22,  phone:"(619) 555-0421", whatsapp:"+16195550421", email:"maria.r@outlook.com", photo:"https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80" },
  { id:14, cat:"ff",        name:"Tommy Construction",     type:"Contractor",     loc:"Nashville, TN 37201", deals:78,  badge:"Rehab Specialist", desc:"Licensed contractor specializing in full rehabs under $80K.",      tags:["Licensed","Rehab","Budget"],       verified:true,  rating:4.9, reviews:134, phone:"(615) 555-0507", whatsapp:"+16155550507", email:"tommy@tommyconst.com", photo:"https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80" },
  { id:15, cat:"services",  name:"QuickSurvey Solutions",  type:"Survey",         loc:"Charlotte, NC 28202", deals:145, badge:"Fast Turnaround",  desc:"Professional land surveys with 72-hour turnaround.",              tags:["Survey","Fast","Licensed"],         verified:true,  rating:4.7, reviews:189, phone:"(704) 555-0623", whatsapp:"+17045550623", email:"info@quicksurvey.net", photo:"https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80" },
].map((card) => {
  const geo = CITY_COORDS[card.loc];
  const base = geo ? { ...card, lat: geo.lat, lng: geo.lng } : { ...card };
  return {
    ...base,
    images: base.images && base.images.length ? base.images : (base.photo ? [base.photo] : []),
  };
});

export const PROPERTIES = [
  { id:101, ownerId:1, type:"SFR",      address:"1847 S 48th St", city:"Phoenix, AZ 85001", price:185000, beds:3, baths:2, sqft:"1,320", improvement:"1,320", lot:"5,500", dealTag:"Opportunity", images: ["https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1515263487990-61b07816b324?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1472224311443-9464b0170887?auto=format&fit=crop&w=600&q=80"], objective: "Fix&Flip", rehab: 45000, capRate: 8.5, description: "Beautiful single-family home in desirable Phoenix location. Recently updated kitchen and bathrooms. Perfect flip opportunity with high ARV potential." },
  { id:102, ownerId:1, type:"Commercial", address:"4210 W Thomas Rd", city:"Phoenix, AZ 85001", price:450000, beds:0, baths:0, sqft:"4,800", improvement:"4,800", lot:"8,200", dealTag:"Seller Financing", images: ["https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=600&q=80"], objective: "BRRRR", rehab: 120000, capRate: 7.2, description: "Prime commercial space on busy Thomas Rd. Strong rental history with potential for value-add through light renovations. Ideal BRRRR candidate." },
  { id:103, ownerId:2, type:"Multifamily", address:"2805 Elm Street", city:"Dallas, TX 75201", price:890000, beds:12, baths:8, sqft:"8,500", improvement:"8,500", lot:"12,000", dealTag:"FSBO", images: ["https://images.unsplash.com/photo-1545324418-cc4dc20c7474?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1448630360428-6e238892bc24?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1515263487990-61b07816b324?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1460317442991-0ec239f636a3?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80"], objective: "Multifamily", rehab: 25000, capRate: 9.1, description: "12-unit multifamily building in growing Dallas neighborhood. All units occupied with below-market rents. Great value-add opportunity to increase NOI." },
  { id:104, ownerId:3, type:"SFR",      address:"821 Peach Circle", city:"Atlanta, GA 30303", price:220000, beds:4, baths:2, sqft:"2,100", improvement:"2,100", lot:"7,800", dealTag:"Fix Upper", images: ["https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1475855581690-80accde3ae2b?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=600&q=80"], objective: "Buy&Hold", rehab: 12000, capRate: 6.8, description: "Spacious 4BR family home in established Atlanta neighborhood. Strong rental demand. Tenant-ready with minimal repairs needed." },
  { id:105, ownerId:4, type:"Industrial", address:"1200 Wilshire Blvd", city:"Los Angeles, CA 90012", price:1200000, beds:0, baths:0, sqft:"12,000", improvement:"12,000", lot:"18,500", dealTag:"Motivated Seller", images: ["https://images.unsplash.com/photo-1513506003901-1e6c229e2d15?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1506459225024-1428097a7e18?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80"], objective: "Buy&Hold", rehab: 0, capRate: 5.9, description: "Industrial warehouse on prime LA location. Long-term tenant in place. Turnkey investment with stable cash flow and appreciation potential." },
  { id:106, ownerId:1, type:"SFR",      address:"9821 N 7th Ave", city:"Phoenix, AZ 85001", price:195000, beds:3, baths:1, sqft:"1,100", improvement:"1,100", lot:"6,200", dealTag:"Opportunity", images: ["https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1475855581690-80accde3ae2b?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1513584684374-8bdb7483fe8f?auto=format&fit=crop&w=600&q=80"], objective: "Fix&Flip", rehab: 55000, capRate: 9.2, description: "Solid bones with cosmetic updates needed. Large lot with RV parking. Comps in area support $280K+ ARV after rehab." },
  { id:107, ownerId:2, type:"Office",   address:"3701 McKinney Ave", city:"Dallas, TX 75201", price:650000, beds:0, baths:0, sqft:"5,600", improvement:"5,600", lot:"9,400", dealTag:"Seller Financing", images: ["https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=600&q=80"], objective: "BRRRR", rehab: 35000, capRate: 7.8, description: "Office building in McKinney Avenue district. Update common areas and modernize to command premium rents. Refinance ready after stabilization." },
  { id:108, ownerId:5, type:"Land",     address:"LOT 4, Industrial Park", city:"Las Vegas, NV 89101", price:380000, beds:0, baths:0, sqft:"2.5 ac", improvement:"0", lot:"2.5 ac", dealTag:"FSBO", images: ["https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=600&q=80"], objective: "SUB-TO", rehab: 0, capRate: 12.1, description: "2.5-acre industrial lot with all utilities available. Zoned for warehouse/distribution. Owner financing available - subject to existing terms." },
  { id:109, ownerId:9, type:"SFR",      address:"234 Oak Ridge Road", city:"Houston, TX 77002", price:165000, beds:3, baths:2, sqft:"1,450", improvement:"1,450", lot:"6,800", dealTag:"Fix Upper", images: ["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1513584684374-8bdb7483fe8f?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?auto=format&fit=crop&w=600&q=80"], objective: "Fix&Flip", rehab: 65000, capRate: 8.9, description: "Dated but structurally sound Houston home. Open floor plan. Full interior/exterior rehab needed. Strong neighborhood comps at $260K+." },
  { id:110, ownerId:10, type:"SFR",     address:"5678 Cherry Lane", city:"Denver, CO 80202", price:280000, beds:4, baths:2, sqft:"2,000", improvement:"2,000", lot:"8,500", dealTag:"Motivated Seller", images: ["https://images.unsplash.com/photo-1570129477492-45ac003000e1?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1513584684374-8bdb7483fe8f?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?auto=format&fit=crop&w=600&q=80", "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=600&q=80"], objective: "Buy&Hold", rehab: 15000, capRate: 7.5, description: "Move-in ready rental property in hot Denver market. Current tenant on month-to-month. Strong appreciation metrics and rental demand." },
  // additional seeded properties (111-130) distributed across mock users
  { id:111, ownerId:6, type:"SFR", address:"1421 Biscayne Ave", city:"Miami, FL 33131", price:225000, beds:3, baths:2, sqft:"1,350", improvement:"1,350", lot:"5,900", dealTag:"Fix Upper", images:["https://images.unsplash.com/photo-1505691723518-36aabc8b3cde?auto=format&fit=crop&w=800&q=80","https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80"], objective:"Fix&Flip", rehab:30000, capRate:8.1, description:"Cozy Miami bungalow with great rental comps nearby. Perfect for cosmetic rehab."},
  { id:112, ownerId:5, type:"Multifamily", address:"221 Oceanview Dr", city:"Los Angeles, CA 90012", price:1290000, beds:8, baths:6, sqft:"6,800", improvement:"6,800", lot:"10,000", dealTag:"Value Add", images:["https://images.unsplash.com/photo-1528909514045-2fa4ac7a08ba?auto=format&fit=crop&w=800&q=80","https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:120000, capRate:6.2, description:"Large multifamily close to transit. Upside through unit renovations and rent growth."},
  { id:113, ownerId:2, type:"SFR", address:"88 Desert Bloom Rd", city:"Phoenix, AZ 85001", price:175000, beds:3, baths:1, sqft:"1,100", improvement:"1,100", lot:"6,000", dealTag:"Opportunity", images:["https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=800&q=80"], objective:"Fix&Flip", rehab:35000, capRate:9.0, description:"Quick flip near downtown with good comps; needs kitchen update."},
  { id:114, ownerId:3, type:"Commercial", address:"400 Commerce St", city:"Dallas, TX 75201", price:520000, beds:0, baths:2, sqft:"5,200", improvement:"5,200", lot:"9,000", dealTag:"Seller Financing", images:["https://images.unsplash.com/photo-1499415479124-43c32433a620?auto=format&fit=crop&w=800&q=80"], objective:"BRRRR", rehab:45000, capRate:7.5, description:"Retail strip with long-term tenants; light cosmetic updates will boost rents."},
  { id:115, ownerId:4, type:"SFR", address:"12 Peachtree Ln", city:"Atlanta, GA 30303", price:199000, beds:4, baths:2, sqft:"1,900", improvement:"1,900", lot:"7,500", dealTag:"Fix Upper", images:["https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:20000, capRate:7.0, description:"Charming home in a family-friendly neighborhood; rent-ready after minor repairs."},
  { id:116, ownerId:7, type:"Land", address:"Parcel B, Sunrise Park", city:"Las Vegas, NV 89101", price:420000, beds:0, baths:0, sqft:"2.8 ac", improvement:"0", lot:"2.8 ac", dealTag:"FSBO", images:["https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80"], objective:"SUB-TO", rehab:0, capRate:11.0, description:"Development-ready parcel with utilities on site, zoned for light industrial."},
  { id:117, ownerId:8, type:"SFR", address:"77 Pike Ave", city:"Seattle, WA 98101", price:365000, beds:3, baths:2, sqft:"1,650", improvement:"1,650", lot:"5,200", dealTag:"Motivated Seller", images:["https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:8000, capRate:6.9, description:"Well-located home near downtown; strong long-term appreciation."},
  { id:118, ownerId:9, type:"Commercial", address:"900 Harbor Rd", city:"San Diego, CA 92101", price:980000, beds:0, baths:2, sqft:"9,800", improvement:"9,800", lot:"15,000", dealTag:"Auction", images:["https://images.unsplash.com/photo-1470123808288-63f7a1ae5a23?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:60000, capRate:5.5, description:"Mixed-use building near port; renovation will attract higher-paying tenants."},
  { id:119, ownerId:10, type:"SFR", address:"142 North Pine", city:"Denver, CO 80202", price:310000, beds:4, baths:3, sqft:"2,150", improvement:"2,150", lot:"9,000", dealTag:"Portfolio", images:["https://images.unsplash.com/photo-1502673530728-f79b4cab31b1?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:12000, capRate:7.3, description:"Spacious family home in an up-and-coming neighborhood with great schools."},
  { id:120, ownerId:11, type:"Multifamily", address:"12 Music Row", city:"Nashville, TN 37201", price:760000, beds:6, baths:4, sqft:"4,200", improvement:"4,200", lot:"7,500", dealTag:"Value Add", images:["https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:85000, capRate:8.6, description:"Duplex complex near entertainment district; excellent rental demand."},
  { id:121, ownerId:12, type:"SFR", address:"58 Queen St", city:"Charlotte, NC 28202", price:210000, beds:3, baths:2, sqft:"1,500", improvement:"1,500", lot:"6,000", dealTag:"Opportunity", images:["https://images.unsplash.com/photo-1505691723518-36aabc8b3cde?auto=format&fit=crop&w=800&q=80"], objective:"Fix&Flip", rehab:25000, capRate:8.4, description:"Bungalow with great curb appeal; kitchen and bath upgrades will increase value."},
  { id:122, ownerId:13, type:"SFR", address:"89 Lakeside Blvd", city:"Orlando, FL 32801", price:189000, beds:3, baths:2, sqft:"1,300", improvement:"1,300", lot:"5,800", dealTag:"Seller Financing", images:["https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:15000, capRate:7.8, description:"Nice starter rental with steady occupancy history."},
  { id:123, ownerId:1, type:"Office", address:"101 Central Ave", city:"Phoenix, AZ 85001", price:640000, beds:0, baths:2, sqft:"5,400", improvement:"5,400", lot:"8,800", dealTag:"BRRRR", images:["https://images.unsplash.com/photo-1505842465776-3d7b3bf5f5b3?auto=format&fit=crop&w=800&q=80"], objective:"BRRRR", rehab:40000, capRate:7.1, description:"Small office building with stable tenants and upside through modernization."},
  { id:124, ownerId:2, type:"SFR", address:"310 Harbor View", city:"Phoenix, AZ 85001", price:159000, beds:2, baths:1, sqft:"900", improvement:"900", lot:"4,200", dealTag:"Fix Upper", images:["https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=800&q=80"], objective:"Fix&Flip", rehab:22000, capRate:9.3, description:"Compact home ideal for first-time flippers; quick cosmetic updates needed."},
  { id:125, ownerId:3, type:"Industrial", address:"4000 Supply Rd", city:"Los Angeles, CA 90012", price:1500000, beds:0, baths:2, sqft:"18,000", improvement:"18,000", lot:"26,000", dealTag:"Warehouse", images:["https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:0, capRate:5.4, description:"Large warehouse in industrial corridor; steady income from long-term lease."},
  { id:126, ownerId:4, type:"SFR", address:"77 Ocean Breeze", city:"Miami, FL 33131", price:420000, beds:4, baths:3, sqft:"2,400", improvement:"2,400", lot:"8,000", dealTag:"Portfolio", images:["https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:18000, capRate:6.7, description:"Beach-adjacent home attractive to short-term rental market."},
  { id:127, ownerId:5, type:"Office", address:"212 Financial Plaza", city:"Dallas, TX 75201", price:880000, beds:0, baths:4, sqft:"10,200", improvement:"10,200", lot:"14,000", dealTag:"Value Add", images:["https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80"], objective:"BRRRR", rehab:90000, capRate:6.0, description:"Downtown office tower with modernization upside."},
  { id:128, ownerId:6, type:"SFR", address:"418 Palm St", city:"Denver, CO 80202", price:245000, beds:3, baths:2, sqft:"1,450", improvement:"1,450", lot:"6,500", dealTag:"Fix Upper", images:["https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80"], objective:"Fix&Flip", rehab:30000, capRate:8.8, description:"Solid bones with cosmetic work needed; strong ARV in neighborhood."},
  { id:129, ownerId:7, type:"Multifamily", address:"33 Market St", city:"Atlanta, GA 30303", price:680000, beds:10, baths:6, sqft:"5,200", improvement:"5,200", lot:"9,200", dealTag:"Portfolio", images:["https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:60000, capRate:9.5, description:"Tenanted multifamily with opportunity to boost rents through targeted upgrades."},
  { id:130, ownerId:8, type:"Land", address:"Lot 9, South Ridge", city:"Las Vegas, NV 89101", price:275000, beds:0, baths:0, sqft:"1.2 ac", improvement:"0", lot:"1.2 ac", dealTag:"FSBO", images:["https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80"], objective:"SUB-TO", rehab:0, capRate:12.3, description:"Small lot ideal for infill development or storage yard."},
].map((property) => {
  const geo = PROPERTY_COORDS_BY_ID[property.id] || CITY_COORDS[property.city];
  return geo ? { ...property, lat: geo.lat, lng: geo.lng } : property;
});

// Additional seeded properties (131-140)
export const EXTRA_PROPERTIES = [
  { id:131, ownerId:2, type:"SFR", address:"451 Maple Grove", city:"Phoenix, AZ 85001", price:199000, beds:3, baths:2, sqft:"1,280", improvement:"1,280", lot:"5,600", dealTag:"Quick Sale", images:["https://images.unsplash.com/photo-1505691723518-36aabc8b3cde?auto=format&fit=crop&w=800&q=80"], objective:"Fix&Flip", rehab:28000, capRate:8.0, description:"Charming starter home close to transport and schools."},
  { id:132, ownerId:3, type:"Commercial", address:"22 Market Plaza", city:"Dallas, TX 75201", price:720000, beds:0, baths:2, sqft:"6,400", improvement:"6,400", lot:"9,200", dealTag:"Value Add", images:["https://images.unsplash.com/photo-1499415479124-43c32433a620?auto=format&fit=crop&w=800&q=80"], objective:"BRRRR", rehab:62000, capRate:7.9, description:"Retail strip in busy corridor with opportunity for lease-up."},
  { id:133, ownerId:4, type:"SFR", address:"19 Sunset Blvd", city:"Los Angeles, CA 90012", price:425000, beds:4, baths:3, sqft:"2,200", improvement:"2,200", lot:"7,800", dealTag:"Portfolio", images:["https://images.unsplash.com/photo-1502673530728-f79b4cab31b1?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:15000, capRate:6.4, description:"Spacious home in growing neighborhood."},
  { id:134, ownerId:5, type:"Office", address:"7 Commerce Row", city:"Atlanta, GA 30303", price:520000, beds:0, baths:2, sqft:"4,600", improvement:"4,600", lot:"8,000", dealTag:"Lease", images:["https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:30000, capRate:6.8, description:"Modernizable office building near transit."},
  { id:135, ownerId:6, type:"SFR", address:"88 Coral Way", city:"Miami, FL 33131", price:310000, beds:3, baths:2, sqft:"1,480", improvement:"1,480", lot:"5,400", dealTag:"Fix Upper", images:["https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80"], objective:"Fix&Flip", rehab:35000, capRate:8.2, description:"Bungalow with great rental comps near the beach."},
  { id:136, ownerId:7, type:"Land", address:"Parcel D, Westfield", city:"Las Vegas, NV 89101", price:220000, beds:0, baths:0, sqft:"1.6 ac", improvement:"0", lot:"1.6 ac", dealTag:"FSBO", images:["https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80"], objective:"SUB-TO", rehab:0, capRate:11.5, description:"Compact parcel ideal for infill or storage."},
  { id:137, ownerId:8, type:"SFR", address:"300 Harbor Lane", city:"San Diego, CA 92101", price:375000, beds:3, baths:2, sqft:"1,600", improvement:"1,600", lot:"6,200", dealTag:"Portfolio", images:["https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:12000, capRate:6.6, description:"Coastal home attractive to long-term rentals."},
  { id:138, ownerId:9, type:"Multifamily", address:"44 River St", city:"Houston, TX 77002", price:640000, beds:8, baths:5, sqft:"4,800", improvement:"4,800", lot:"9,000", dealTag:"Value Add", images:["https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:50000, capRate:9.0, description:"Tenanted multifamily with upside through renovations."},
  { id:139, ownerId:10, type:"SFR", address:"12 Pine Grove", city:"Denver, CO 80202", price:289000, beds:4, baths:2, sqft:"1,900", improvement:"1,900", lot:"7,900", dealTag:"Motivated Seller", images:["https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:9000, capRate:7.2, description:"Solid home in commuter-friendly neighborhood."},
  { id:140, ownerId:11, type:"Office", address:"2 Music Row", city:"Nashville, TN 37201", price:980000, beds:0, baths:4, sqft:"10,400", improvement:"10,400", lot:"12,000", dealTag:"Portfolio", images:["https://images.unsplash.com/photo-1496307042754-b4aa456c4a2d?auto=format&fit=crop&w=800&q=80"], objective:"Buy&Hold", rehab:90000, capRate:8.1, description:"Commercial property near entertainment district."},
].map((property) => {
  const geo = PROPERTY_COORDS_BY_ID[property.id] || CITY_COORDS[property.city];
  return geo ? { ...property, lat: geo.lat, lng: geo.lng } : property;
});

export const SERVICE_PORTFOLIO = [
  {
    id: 'svc-1001',
    ownerId: 6, // LensUp Media (Miami)
    title: 'Aerial & Interior Photography',
    category: 'svc_photo',
    description: 'High-quality aerial drone shoots and professional interior photography for listings and portfolios.',
    price: 350,
    media: { images: ['https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=800&q=80'] },
    publishToConnections: true,
    source: 'seed',
  },
  {
    id: 'svc-1002',
    ownerId: 8, // ClearTitle Co. (Houston)
    title: 'Express Title Search',
    category: 'svc_title',
    description: 'Fast, reliable title searches and insurance clearance for quick closings.',
    price: 150,
    media: { images: ['https://images.unsplash.com/photo-1588702547923-7093a6c3ba33?auto=format&fit=crop&w=800&q=80'] },
    publishToConnections: true,
    source: 'seed',
  },
  {
    id: 'svc-1003',
    ownerId: 7, // Apex RE Consulting (Austin)
    title: 'Investment Feasibility',
    category: 'svc_d4d',
    description: 'Feasibility studies and deal modeling to help you underwrite deals fast.',
    price: 500,
    media: { images: ['https://images.unsplash.com/photo-1559526324-593bc073d938?auto=format&fit=crop&w=800&q=80'] },
    publishToConnections: true,
    source: 'seed',
  },
];

export const MATCHES = [
  ...CARDS.slice(0, 3).map(c => ({
    ...c,
    last: "Hey, interested in your latest listing!",
    time: "2m",
    unread: 1
  }))
];
