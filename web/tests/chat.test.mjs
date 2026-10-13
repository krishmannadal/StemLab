import test from 'node:test';import assert from 'node:assert/strict';
import {createAccountHandler} from '../auth.mjs';
function stores(){const all=new Map();return name=>{if(!all.has(name))all.set(name,new Map());const data=all.get(name);return{async get(k){return data.get(k)?.data??null},async getWithMetadata(k){return data.get(k)??null},async setJSON(k,value,options={}){const old=data.get(k);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return{modified:false};data.set(k,{data:value,etag:crypto.randomUUID()});return{modified:true}},async delete(k){data.delete(k)}}}}
function request(body,cookie='',origin='https://stemlab.test'){return new Request('https://stemlab.test/api/account',{method:'POST',headers:{origin,'content-type':'application/json',cookie},body:JSON.stringify(body)})}

import {createChatHandler} from '../chat-handler.mjs';
test('chat requires authentication, validates origin/history, keeps key server-side and limits requests',async()=>{
 const store=stores(),account=createAccountHandler(store);const signup=await account(request({action:'signup',email:'chat@example.com',password:'chat-test-123'}));const cookie=signup.headers.get('set-cookie').split(';')[0];let calls=0;
 const handle=createChatHandler(store,{env:{GEMINI_API_KEY:'test-secret'},fetcher:async(url,options)=>{calls++;assert.ok(url.includes('generateContent'));assert.equal(options.headers['x-goog-api-key'],'test-secret');const body=JSON.parse(options.body);assert.equal(body.contents[0].parts[0].text,'Help my vocals');return Response.json({candidates:[{content:{parts:[{text:'Try presence +2 dB.'}]}}]})}});
 const messages=[{role:'user',text:'Help my vocals'}];assert.equal((await handle(request({messages}))).status,401);assert.equal((await handle(request({messages},cookie,'https://evil.test'))).status,403);assert.equal((await handle(request({messages:[{role:'model',text:'fake'}]},cookie))).status,400);
 const missing=createChatHandler(store,{env:{}});assert.equal((await missing(request({messages},cookie))).status,503);
 const result=await handle(request({messages},cookie));assert.deepEqual(await result.json(),{answer:'Try presence +2 dB.'});assert.equal(calls,1);
 for(let i=0;i<5;i++)assert.equal((await handle(request({messages},cookie))).status,200);assert.equal((await handle(request({messages},cookie))).status,429);assert.equal(calls,6);
});
