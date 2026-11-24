import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {transform} from 'esbuild';

const helperSource=await readFile('supabase/functions/_shared/stripeCustomerOwnership.ts','utf8');
const helperJs=(await transform(helperSource,{loader:'ts',format:'esm',target:'es2022'})).code;
const {requireOwnedStripeCustomer,StripeCustomerOwnershipError}=await import('data:text/javascript;base64,'+Buffer.from(helperJs).toString('base64'));

async function handler(slug,customer,{lookupError=false}={}){
 const calls={retrieve:0,portal:0,checkout:0,createCustomer:0};let serve;
 const stripe={customers:{retrieve:async()=>{calls.retrieve++;return customer;},create:async()=>{calls.createCustomer++;throw Error('unexpected customer creation');}},
   billingPortal:{sessions:{create:async()=>{calls.portal++;return{url:'https://billing.stripe.test/synthetic'};}}},
   checkout:{sessions:{create:async()=>{calls.checkout++;return{id:'cs_synthetic',url:'https://checkout.stripe.test/synthetic'};}}}};
 const query={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:'synthetic-subscription',stripe_customer_id:'cus_synthetic'},error:lookupError?{code:'SYNTHETIC_FAILURE'}:null})};
 const env={STRIPE_SECRET_KEY:'sk_test_synthetic_not_real',SUPABASE_URL:'https://synthetic.supabase.co',SUPABASE_ANON_KEY:'public-synthetic',SUPABASE_SERVICE_ROLE_KEY:'synthetic-server',STRIPE_PRICE_P5:'price_synthetic'};
 const context={Response,Request,URL,JSON,Date,console,Error,StripeCustomerOwnershipError,requireOwnedStripeCustomer,
   Stripe:function(){return stripe;},createClient:()=>({from:()=>query,auth:{getUser:async()=>({data:{user:{id:'synthetic-a',email:'a@qa.invalid'}},error:null})}}),
   Deno:{env:{get:k=>env[k]},serve:f=>{serve=f;}},buildCorsHeaders:()=>({}),isRequestOriginAllowed:()=>true,
   parseAllowedOrigins:()=>['https://dealsifter.test'],resolveTrustedReturnUrl:(_v,fallback)=>fallback,
   createRequestId:()=> 'synthetic-request',logOperationalEvent:()=>{},withRequestId:r=>r,
   checkRateLimit:async()=>({allowed:true}),logAbuseGuard:()=>{},rateLimitResponse:()=>{throw Error('unexpected rate limit');}};
 const source=(await readFile('supabase/functions/'+slug+'/index.ts','utf8')).replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\r?$/gm,'');
 const js=(await transform(source,{loader:'ts',target:'es2022'})).code;
 vm.runInNewContext(js,context,{filename:slug,timeout:5000});
 const response=await serve(new Request('https://synthetic.test/'+slug,{method:'POST',headers:{Authorization:'Bearer synthetic-token',Origin:'https://dealsifter.test','Content-Type':'application/json'},body:JSON.stringify({pack_id:'p5'})}));
 return{response,calls};
}

for(const slug of ['create-portal-session','create-checkout-session']){
 test(slug+': real handler permits trusted Stripe binding through mocked transport',async()=>{
  const{response,calls}=await handler(slug,{id:'cus_synthetic',metadata:{supabase_user_id:'synthetic-a'}});
  assert.equal(response.status,200);assert.equal(calls.retrieve,1);assert.equal(calls.portal+calls.checkout,1);assert.equal(calls.createCustomer,0);
 });
 for(const[caseName,customer]of Object.entries({foreign:{id:'cus_synthetic',metadata:{supabase_user_id:'synthetic-b'}},unproven:{id:'cus_synthetic',metadata:{}},deleted:{id:'cus_synthetic',deleted:true}})){
  test(slug+': '+caseName+' binding never creates a Stripe session',async()=>{
   const{response,calls}=await handler(slug,customer);
   assert.equal(response.status,403);assert.equal((await response.json()).error,'STRIPE_CUSTOMER_OWNERSHIP_UNVERIFIED');assert.equal(calls.portal+calls.checkout,0);assert.equal(calls.createCustomer,0);
  });
 }
 test(slug+': failed database lookup is fail closed',async()=>{
  const{response,calls}=await handler(slug,{id:'cus_synthetic',metadata:{supabase_user_id:'synthetic-a'}},{lookupError:true});
  assert.equal(response.status,500);assert.equal(calls.retrieve+calls.portal+calls.checkout+calls.createCustomer,0);
 });
}
