import {useEffect,useMemo} from 'react';
import {usePropertyFactReview} from './PropertyFactReviewContext';
import {actionableReview} from '../../../supabase/functions/_shared/property-fact-reconciliation/reviewProjection.js';
import {factCopy} from './copy';
export function PropertyFactNotificationSync({notifications,setNotifications,language}){
 const review=usePropertyFactReview();
 const notices=useMemo(()=>{
  const copy=factCopy(language);
  return (notifications||[]).filter(item=>item.type==='property_data'&&review?.ownedProperties.has(String(item.propertyId))).flatMap(item=>{
   const projection=actionableReview(review.records[item.propertyId]?.snapshot);if(!projection.summary.pending)return [];
   return [{id:`property-facts-${item.id}`,source:'property_fact_review',notificationId:item.id,propertyId:item.propertyId,
    field:projection.items.find(row=>row.kind==='CONFLICT')?.field||projection.items[0].field,read:item.read,
    title:projection.summary.conflicts?copy.conflictsTitle:copy.neutralTitle,message:copy.summary(projection.summary.complements,projection.summary.conflicts),createdAt:item.createdAt}];
  });
 },[notifications,review,language]);
 useEffect(()=>{setNotifications(previous=>{
  const next=[...notices,...(previous||[]).filter(item=>item.source!=='property_fact_review')].slice(0,100);
  const same=(previous||[]).length===next.length&&next.every((item,index)=>item===(previous||[])[index]||item.source==='property_fact_review'&&['id','read','title','message','field'].every(key=>item[key]===previous[index]?.[key]));
  return same?previous:next;
 });},[notices,setNotifications]);
 return null;
}
