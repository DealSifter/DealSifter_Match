// A request lifecycle for the existing flag service, not a new flag framework.
export function createFeatureFlagRefresh({ fetcher, publish, now = Date.now, schedule = setTimeout, cancel = clearTimeout }) {
  let disposed=false; let pending=null; let timer=null; let retries=0; let lastAttempt=-Infinity;
  const refresh = ({ force=false } = {}) => {
    if(disposed)return Promise.resolve();
    if(pending)return pending;
    if(!force&&now()-lastAttempt<10000)return Promise.resolve();
    if(timer!==null){cancel(timer);timer=null;}
    lastAttempt=now(); publish(null,'pending');
    pending=Promise.resolve().then(fetcher).catch(()=>({source:'fallback'})).then(snapshot=>{
      if(disposed)return;
      publish(snapshot,snapshot?.source==='server'?'ready':'unavailable');
      if(snapshot?.source!=='server'&&retries<3) {
        const delay=[2000,10000,30000][retries++];
        timer=schedule(()=>{timer=null;void refresh({force:true});},delay);
      } else if(snapshot?.source==='server')retries=0;
    }).finally(()=>{pending=null;});
    return pending;
  };
  return {refresh,dispose:()=>{disposed=true;if(timer!==null)cancel(timer);}};
}
