import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();context.setDefaultTimeout(12000);
const errors=[];
const stub=`window.testAuth={session:null,listeners:[],reads:0,otp:0,failLogout:false,delayMetrics:false,metricsCalls:0,
 emit(event,session){this.session=session;this.listeners.forEach(fn=>fn(event,session));}};
window.supabase={createClient:()=>({auth:{
 onAuthStateChange(fn){testAuth.listeners.push(fn);queueMicrotask(()=>fn('INITIAL_SESSION',testAuth.session));return {data:{subscription:{unsubscribe(){}}}};},
 async getSession(){testAuth.reads++;return {data:{session:testAuth.session}};},
 async signInWithOtp(){testAuth.otp++;testAuth.emit('SIGNED_OUT',null);await new Promise(r=>setTimeout(r,50));return {error:null};},
 async signOut(){if(testAuth.failLogout)return {error:{message:'failure'}};testAuth.emit('SIGNED_OUT',null);return {error:null};}
 },rpc:async()=>{testAuth.metricsCalls++;if(testAuth.delayMetrics)await new Promise(r=>testAuth.finishMetrics=r);return {data:{events:0,sessions:0,daily:[]},error:null};}})};`;
await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
try{
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://unpkg.com/**',r=>r.fulfill({contentType:'application/javascript',body:stub}));
 await page.goto(base+'/index.html#profile');await page.waitForFunction(()=>window.OTAuth?.snapshot().ready);
 await page.locator('#loginEmail').fill('test@example.test');
 await page.evaluate(()=>{window.originalForm=document.getElementById('loginForm');testAuth.emit('TOKEN_REFRESHED',null);});
 await page.waitForTimeout(50);assert.equal(await page.locator('#loginEmail').inputValue(),'test@example.test');
 assert.equal(await page.evaluate(()=>originalForm===document.getElementById('loginForm')),true);
 await page.locator('#loginForm button').click();await page.getByText('메일함에서 로그인 링크를 확인해 주세요.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>testAuth.otp),1);
 await page.evaluate(()=>testAuth.emit('SIGNED_IN',{user:{id:'test-user',email:'member@example.test'}}));
 await page.locator('#accountState .signed-in').waitFor();assert.ok((await page.locator('#sideIdentity').textContent()).includes('member@example.test'));
 await page.evaluate(()=>testAuth.failLogout=true);await page.locator('[data-action="logout"]').click();await page.getByText('로그아웃하지 못했습니다. 다시 시도해 주세요.',{exact:true}).waitFor();assert.equal(await page.locator('[data-action="logout"]').count(),1);
 await page.evaluate(()=>testAuth.failLogout=false);await page.locator('[data-action="logout"]').click();await page.locator('#loginForm').waitFor();assert.ok(!(await page.locator('#sideIdentity').textContent()).includes('member@example.test'));
 assert.equal(await page.evaluate(()=>testAuth.reads),1,'auth events must not recursively call getSession');
 // SDK network failure leaves callback intact, so the user can retry safely.
 const callback=await context.newPage();callback.on('pageerror',e=>errors.push(e.message));
 await callback.goto(base+'/index.html#access_token=test-only&refresh_token=test-only');
 await callback.getByText('로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.',{exact:true}).waitFor();
 assert.ok(callback.url().includes('access_token=test-only'));
 await callback.route('https://unpkg.com/**',r=>r.fulfill({contentType:'application/javascript',body:stub}));
 await callback.locator('[data-action="check-session"]').click();await callback.waitForFunction(()=>OTAuth.snapshot().ready);
 // An older metrics response must not restore data after logout.
 const admin=await context.newPage();admin.on('pageerror',e=>errors.push(e.message));
 await admin.route('https://unpkg.com/**',r=>r.fulfill({contentType:'application/javascript',body:stub+`;testAuth.session={user:{id:'admin',email:'admin@example.test'}};testAuth.delayMetrics=true;`}));
 await admin.goto(base+'/admin.html');await admin.waitForFunction(()=>!!window.testAuth?.finishMetrics);
 assert.equal(await admin.evaluate(()=>testAuth.metricsCalls),1,'initial session must not duplicate metrics requests');
 await admin.locator('#signOut').click();await admin.locator('#adminLogin').waitFor();
 await admin.evaluate(()=>testAuth.finishMetrics());await admin.waitForTimeout(100);
 assert.equal(await admin.locator('.metric').count(),0);
 assert.equal(await admin.locator('#refresh').isDisabled(),false);
 // A new session can load fresh metrics after the superseded request finishes.
 await admin.evaluate(()=>{testAuth.delayMetrics=false;testAuth.emit('SIGNED_IN',{user:{id:'admin',email:'admin@example.test'}});});
 await admin.locator('.metric').first().waitFor();assert.equal(await admin.evaluate(()=>testAuth.metricsCalls),2);
 assert.deepEqual(errors,[]);
 console.log('PASS: auth initialization, typing preservation, OTP status, sign-in/out, failed logout, SDK retry, no recursive auth requests, stale admin response isolation.');
}finally{await browser.close();}
