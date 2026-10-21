import {createHash} from 'node:crypto';
import {controls} from './src/effects.mjs';
const root='https://generativelanguage.googleapis.com/v1beta';
export class GeminiError extends Error{constructor(code,message,status=502){super(message);this.code=code;this.status=status}}
async function decode(response){const data=await response.json().catch(()=>({}));if(response.ok)return data;const reason=data.error?.details?.find(x=>x.reason)?.reason||'';const msg=data.error?.message||'';
 if(/API_KEY_INVALID|API_KEY_EXPIRED/.test(reason)||/api key not valid|api key expired|leaked/i.test(msg))throw new GeminiError('KEY_INVALID','Google rejected the Gemini API key. Replace GEMINI_API_KEY in Netlify (Functions scope) and redeploy.',503);
 if(response.status===401||response.status===403||/API_KEY_.*BLOCKED/.test(reason))throw new GeminiError('ACCESS_DENIED','Google denied access. Check that this key allows the Generative Language API and server requests; browser-referrer restrictions will block Netlify.',503);
 if(response.status===404)throw new GeminiError('MODEL_UNAVAILABLE','The configured Gemini model is unavailable. Remove GEMINI_MODEL in Netlify to select an available Flash model automatically, then redeploy.',503);
 if(response.status===429)throw new GeminiError('QUOTA_EXCEEDED','Gemini quota is exhausted. Check this project’s quota in Google AI Studio or try later.',429);
 if(response.status===400)throw new GeminiError('REQUEST_REJECTED','Google rejected the chat request. Check the Gemini project’s region, billing/access settings and model configuration.',502);
 throw new GeminiError('PROVIDER_UNAVAILABLE','Google Gemini is temporarily unavailable. Try again shortly or use the labelled local preset.',503);
}
export const responseSchema={type:'OBJECT',properties:{answer:{type:'STRING'},suggestion:{type:'OBJECT',properties:{settings:{type:'OBJECT',properties:Object.fromEntries(controls.map(([key])=>[key,{type:'NUMBER'}])),required:controls.map(([key])=>key)}},required:['settings']}},required:['answer']};
export function parseReply(text){let value;try{value=JSON.parse(text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''))}catch{throw new GeminiError('INVALID_RESPONSE','Gemini returned an incomplete recommendation. Please try a shorter request.')}
 if(!value||typeof value!=='object'||typeof value.answer!=='string'||!value.answer.trim())throw new GeminiError('INVALID_RESPONSE','Gemini returned an empty answer. Please try again.');
 let suggestion;if(value.suggestion){const input=value.suggestion.settings;if(!input||controls.some(([key,,min,max])=>typeof input[key]!=='number'||!Number.isFinite(input[key])||input[key]<min||input[key]>max))throw new GeminiError('INVALID_SETTINGS','Gemini returned invalid tuning values. Please ask for another suggestion.');suggestion={settings:Object.fromEntries(controls.map(([key])=>[key,Math.round(input[key])]))}}
 return {answer:value.answer.trim().slice(0,6000),...(suggestion?{suggestion}:{})};
}
export function createGemini({env=process.env,fetcher=fetch,now=()=>Date.now()}={}){
 let cached=null;
 // Accept the existing project-specific variable without exposing or moving its value.
 const credentials=[...new Set([env.GEMINI_API_KEY,env.steamlab].filter(v=>typeof v==='string').map(v=>v.trim()).filter(Boolean))];let credentialIndex=0;
 const key=()=>{const value=credentials[credentialIndex];if(!value)throw new GeminiError('KEY_MISSING','Add GEMINI_API_KEY in Netlify with Functions scope, then redeploy to enable Gemini.',503);return value};
 const api=async(path,options={})=>{const run=()=>fetcher(root+path,{...options,headers:{'Content-Type':'application/json','x-goog-api-key':key()},signal:AbortSignal.timeout(options.method?22000:8000)}).then(decode);try{return await run()}catch(error){if(error.code==='KEY_INVALID'&&credentialIndex+1<credentials.length){credentialIndex++;cached=null;return await run()}throw error}};
 async function model(){const secret=key(),fingerprint=createHash('sha256').update(secret).digest('hex');const configured=(env.GEMINI_MODEL||'').trim().replace(/^models\//,'');if(configured){if(!/^[a-zA-Z0-9._-]+$/.test(configured))throw new GeminiError('MODEL_INVALID','Remove the invalid GEMINI_MODEL setting from Netlify and redeploy.',503);return configured}
  if(cached?.fingerprint===fingerprint&&cached.expires>now())return cached.model;
  const data=await api('/models?pageSize=1000');const available=(data.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')&&/^models\/gemini-/.test(m.name)&&/flash/.test(m.name)&&!/image|audio|tts|live|robotics|transcrib/i.test(m.name));
  available.sort((a,b)=>{const score=m=>(/lite/.test(m.name)?100:0)+(!/preview|experimental|exp-/.test(m.name)?40:0)+(/latest/.test(m.name)?10:0);return score(b)-score(a)||b.name.localeCompare(a.name,undefined,{numeric:true})});
  if(!available.length)throw new GeminiError('NO_MODEL','This Gemini key has no compatible Flash model. Check model access in Google AI Studio.',503);
  const selected=available[0].name.replace('models/','');cached={fingerprint:createHash('sha256').update(key()).digest('hex'),model:selected,expires:now()+900000};return selected;
 }
 return {async check(){const selected=await model();await api('/models/'+selected);return {model:selected,status:'connected'}},async generate(system,messages,context){const selected=await model();const body=await api('/models/'+selected+':generateContent',{method:'POST',body:JSON.stringify({systemInstruction:{parts:[{text:system+'\nReturn ONLY JSON with answer (string) and optional suggestion: {settings:{low,mid,high,compression,reverb,pan}}. Include all six settings for tuning requests. Omit suggestion for factual questions. The user selected the target track; tune that track only. Suggestion values must remain within the documented ranges. Buttons can apply settings after the user clicks, so describe that action instead of claiming it has already happened. Current selected track context: '+JSON.stringify(context)}]},contents:messages.map(m=>({role:m.role,parts:[{text:m.text}]})),generationConfig:{maxOutputTokens:2048,responseMimeType:'application/json',responseSchema}})});
  const text=body.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('').trim();if(!text)throw new GeminiError('NO_ANSWER','Gemini could not answer this request. Try rephrasing it.');return {...parseReply(text),model:selected};
 }};
}
