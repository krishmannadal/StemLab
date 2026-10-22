import test from 'node:test';import assert from 'node:assert/strict';
import {createGemini,parseReply} from '../gemini.mjs';
const settings={low:-2,mid:2,high:3,compression:25,reverb:14,pan:0,pitch:0,formant:0};
test('discover and cache an available Flash model, send structured settings and no deprecated sampling parameter',async()=>{
 let lists=0,requests=0;const client=createGemini({env:{GEMINI_API_KEY:'never-return-me'},fetcher:async(url,options)=>{assert.equal(options.headers['x-goog-api-key'],'never-return-me');if(url.includes('/models?')){lists++;return Response.json({models:[{name:'models/gemini-test-flash-lite',supportedGenerationMethods:['generateContent']},{name:'models/gemini-test-image-flash',supportedGenerationMethods:['generateContent']}]})}if(options.method){requests++;const body=JSON.parse(options.body);assert.equal(body.generationConfig.temperature,undefined);assert.equal(body.generationConfig.responseMimeType,'application/json');assert.match(body.systemInstruction.parts[0].text,/drums/);return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({answer:'Try these settings.',suggestion:{settings}})}]}}]})}return Response.json({name:'models/gemini-test-flash-lite'})}});
 assert.equal((await client.check()).status,'connected');for(let i=0;i<2;i++){const r=await client.generate('Tune', [{role:'user',text:'warm'}],{track:'drums'});assert.deepEqual(r.suggestion.settings,settings);assert.equal(r.model,'gemini-test-flash-lite')}assert.equal(lists,1);assert.equal(requests,2);
});
test('diagnostics distinguish missing key, rejected key, model, quota and permissions without exposing provider secrets',async()=>{
 await assert.rejects(createGemini({env:{}}).check(),e=>e.code==='KEY_MISSING');
 for(const [status,reason,code] of [[400,'API_KEY_INVALID','KEY_INVALID'],[403,'','ACCESS_DENIED'],[404,'','MODEL_UNAVAILABLE'],[429,'','QUOTA_EXCEEDED'],[503,'','PROVIDER_UNAVAILABLE']]){const client=createGemini({env:{GEMINI_API_KEY:'private-key',GEMINI_MODEL:'test'},fetcher:async()=>Response.json({error:{message:'provider private-key internal details',details:[{reason}]}},{status})});await assert.rejects(client.check(),e=>e.code===code&&!e.message.includes('private-key'))}
});
test('reject partial, nonnumeric, out-of-range or malformed recommendations',()=>{for(const bad of [{low:2},{...settings,reverb:100},{...settings,pan:'0'}])assert.throws(()=>parseReply(JSON.stringify({answer:'test',suggestion:{settings:bad}})));assert.throws(()=>parseReply('not JSON'));assert.deepEqual(parseReply('{"answer":"No effects needed."}'),{answer:'No effects needed.'})});

test('supports project key variable and replaces a rejected old key without logging secrets',async()=>{
 const calls=[];const client=createGemini({env:{GEMINI_API_KEY:'old-key',steamlab:' new-key '},fetcher:async(url,options)=>{calls.push(options.headers['x-goog-api-key']);if(options.headers['x-goog-api-key']==='old-key')return Response.json({error:{details:[{reason:'API_KEY_INVALID'}]}},{status:400});if(url.includes('/models?'))return Response.json({models:[{name:'models/gemini-test-flash',supportedGenerationMethods:['generateContent']}]});return Response.json({name:'models/gemini-test-flash'})}});
 assert.equal((await client.check()).status,'connected');assert.equal((await client.check()).status,'connected');assert.deepEqual(calls,['old-key','new-key','new-key','new-key']);
 const aliasOnly=createGemini({env:{steamlab:'new-key',GEMINI_MODEL:'gemini-test-flash'},fetcher:async(url,options)=>{assert.equal(options.headers['x-goog-api-key'],'new-key');return Response.json({name:'models/gemini-test-flash'})}});assert.equal((await aliasOnly.check()).status,'connected');
});

 test('pitch and formant recommendations retain half-semitones and reject unsafe values',()=>{
 const reply=v=>JSON.stringify({answer:'Try this voice treatment.',suggestion:{settings:{...settings,...v}}});
 assert.equal(parseReply(reply({pitch:4.5,formant:2.5})).suggestion.settings.pitch,4.5);
 assert.equal(parseReply(reply({pitch:4.5,formant:2.5})).suggestion.settings.formant,2.5);
 for(const invalid of [{pitch:13},{formant:-9},{pitch:'5'},{formant:null}])assert.throws(()=>parseReply(reply(invalid)));
 });
