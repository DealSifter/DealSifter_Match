import{test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{transform}from'esbuild';import vm from'node:vm';import{webcrypto}from'node:crypto';
const raw=await readFile('supabase/functions/presentation-translate/index.ts','utf8'),source=raw.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\r?$/gm,''),js=(await transform(source,{loader:'ts',target:'es2022'})).code;
async function run({cached=false,limited=false,sameLanguage=false}={}){
 let serve;const calls={guard:0,generation:0,close:0,updates:0};
 const query={select(){return this;},eq(){return this;},gte(){return this;},maybeSingle:async()=>({data:cached?{state:'READY',translated_text:'cached synthetic',translated_at:'2026-11-25'}:null,error:null}),then(resolve){return Promise.resolve({count:0,error:null}).then(resolve);},update(){calls.updates++;return this;}};
 const client={auth:{getUser:async()=>({data:{user:{id:'f1250000-0000-4000-8000-000000000001'}}})},from:()=>query,rpc:async()=>({data:true,error:null})};
 const ctx={Response,Request,URL,JSON,Date,TextEncoder,crypto:webcrypto,console,
 Deno:{serve:fn=>serve=fn},createClient:()=>client,corsHeaders:()=>({}),supabaseUrl:'https://synthetic.supabase.co',supabaseAnonKey:'synthetic',supabaseServiceRoleKey:'synthetic',geminiApiKey:'synthetic',geminiModels:['gemini-3.5-flash-lite'],
 safeOriginalNarrative:s=>s,parsePresentationTranslation:s=>s,
 protectNarrativeIdentifiers:text=>({text,tokens:[]}),restoreNarrativeIdentifiers:text=>text,
 buildGeminiGenerationConfig:(_m,n)=>({maxOutputTokens:n}),
 createGeminiUsageSession:()=>{calls.guard++;return{close:async()=>calls.close++};},
 callGemini:async(_m,_body,timeout,usage)=>{assert.equal(timeout,15000);assert.ok(usage);calls.generation++;if(limited)throw Error('GEMINI_FREE_POOL_LIMIT');return{response:{ok:true},payload:{candidates:[{finishReason:'STOP',content:{parts:[{text:'synthetic translation'}]}}]}};}};
 vm.runInNewContext(js,ctx,{timeout:5000});const response=await serve(new Request('https://synthetic.invalid/translation',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({text:'synthetic original',fromLang:'en',toLang:sameLanguage?'en':'pt'})}));return{data:await response.json(),calls};
}
test('actual translation handler: cache hit avoids generative quota',async()=>{const r=await run({cached:true});assert.equal(r.data.translationSource,'cached-gemini');assert.equal(r.calls.guard,0);assert.equal(r.calls.generation,0);});
test('actual translation handler: local same-language keeps original without quota',async()=>{const r=await run({sameLanguage:true});assert.equal(r.data.translatedText,'synthetic original');assert.equal(r.calls.generation,0);});
test('actual translation handler: external path passes guard and preserves timeout',async()=>{const r=await run();assert.equal(r.data.translationSource,'gemini');assert.equal(r.calls.guard,1);assert.equal(r.calls.generation,1);assert.equal(r.calls.close,1);});
test('actual translation handler: quota rejection retains original content',async()=>{const r=await run({limited:true});assert.equal(r.data.translationSource,'original');assert.equal(r.data.translatedText,'synthetic original');assert.equal(r.calls.close,1);});
