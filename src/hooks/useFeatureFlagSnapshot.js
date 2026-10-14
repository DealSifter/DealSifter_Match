import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFeatureFlagsWithRetry, normalizeFeatureFlagResponse } from '../services/featureFlagService';
import { createFeatureFlagRefresh } from '../services/featureFlagRefresh';
const noOverrides=()=>null;

export function useFeatureFlagSnapshot(accountKey, overridesReader=noOverrides) {
  const [state,setState]=useState({owner:'',snapshot:normalizeFeatureFlagResponse(null),phase:'idle'});
  const controllerRef=useRef(null);
  useEffect(()=>{
    if(!accountKey)return undefined;
    const controller=createFeatureFlagRefresh({
      fetcher:()=>fetchFeatureFlagsWithRetry({overrides:overridesReader()}),
      publish:(snapshot,phase)=>setState(previous=>phase==='pending'&&previous.owner===accountKey
        ? {...previous,phase}
        : {owner:accountKey,snapshot:normalizeFeatureFlagResponse(snapshot),phase}),
    });
    controllerRef.current={owner:accountKey,controller};
    const resume=()=>{if(document.visibilityState!=='hidden')void controller.refresh();};
    window.addEventListener('online',resume);window.addEventListener('focus',resume);document.addEventListener('visibilitychange',resume);
    void controller.refresh();
    return ()=>{controller.dispose();window.removeEventListener('online',resume);window.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',resume);};
  },[accountKey,overridesReader]);
  const refresh=useCallback(()=>controllerRef.current?.owner===accountKey?controllerRef.current.controller.refresh({force:true}):Promise.resolve(),[accountKey]);
  const current=state.owner===accountKey?state:{snapshot:normalizeFeatureFlagResponse(null),phase:accountKey?'pending':'idle'};
  return {...current,refresh};
}
