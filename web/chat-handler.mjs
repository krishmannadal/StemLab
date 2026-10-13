import {createHash} from 'node:crypto';
import {createAccountHandler} from './auth.mjs';
const digest=s=>createHash('sha256').update(s).digest('hex');
const system=`You are StemLab's friendly music studio assistant. Explain music mixing and deep learning simply and concisely. StemLab uses pretrained HT Demucs ONNX in a desktop browser, with 4 stems: vocals, drums, bass, other. Neural separation is limited to 1–30 seconds and 10 MB and disabled on mobile. The mixer supports volume, mute, solo, imported audio, loops, downloads and per-track tuning: low/mid/high EQ, compression, reverb, stereo pan. The local prompt presets are rule-based. You can suggest exact slider values but cannot hear, analyze, generate, change or clone audio, execute actions, or access recordings. Say when an action needs the user to perform it. No claims of model training by the student team. Audio stays local; only chat text is sent to Gemini. Stay focused on music, StemLab and its AI/DL explanations. Do not request passwords or API keys.`;
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function createChatHandler(storeFor,{env=process.env,fetcher=fetch,now=()=>Date.now()}={}){
 const account=createAccountHandler(storeFor,now);
 return async(req)=>{
  try{
   if(req.method!=='POST')return reply({error:'Method not allowed'},405);
   if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Request origin is not allowed'},403);
   if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Send JSON'},415);
   const auth=await account(new Request(req.url,{headers:req.headers}));if(!auth.ok)return reply({error:'Log in to chat with your studio assistant.'},401);
   const {user}=await auth.json();const text=await req.text();if(Buffer.byteLength(text)>16000)return reply({error:'Message is too long.'},413);
   let input;try{input=JSON.parse(text)}catch{return reply({error:'Invalid request'},400)}
   const messages=input?.messages;if(!Array.isArray(messages)||!messages.length||messages.length>12||messages.at(-1)?.role!=='user'||messages.some((m,i)=>m.role!==(i%2?'model':'user')||typeof m.text!=='string'||!m.text.trim()||m.text.length>1200))return reply({error:'Use a message of 1–1200 characters and a valid conversation.'},400);
   if(!env.GEMINI_API_KEY)return reply({error:'Gemini chat is not configured yet. The site owner needs to add GEMINI_API_KEY in Netlify.'},503);
   const limits=storeFor('stemlab-chat-rate');for(const [duration,max,label] of [[60000,6,'minute'],[86400000,40,'day']]){const key=digest(user.id+':'+duration+':'+Math.floor(now()/duration));let allowed=false;for(let i=0;i<5;i++){const old=await limits.getWithMetadata(key,{type:'json'});const count=old?.data?.count||0;if(count>=max)return reply({error:`Chat limit reached. Please try again next ${label}.`},429);const result=await limits.setJSON(key,{count:count+1},{...(old?{onlyIfMatch:old.etag}:{onlyIfNew:true})});if(result.modified){allowed=true;break}}if(!allowed)return reply({error:'Chat is busy. Try again shortly.'},429)}
   const model=env.GEMINI_MODEL||'gemini-3.5-flash-lite';if(!/^[a-zA-Z0-9._-]+$/.test(model))return reply({error:'Chat model configuration is invalid.'},503);
   const result=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:messages.map(m=>({role:m.role,parts:[{text:m.text}]})),generationConfig:{maxOutputTokens:700,temperature:.5}}),signal:AbortSignal.timeout(25000)});
   if(!result.ok)return reply({error:result.status===429?'Gemini quota reached. Please try again later.':'Gemini is unavailable. Please check the server key and model configuration or try later.'},result.status===429?429:502);
   const body=await result.json();const answer=body.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('').trim();return answer?reply({answer:answer.slice(0,6000)}):reply({error:'Gemini could not answer this message. Try rephrasing it.'},502);
  }catch{return reply({error:'Chat could not connect. Please try again.'},503)}
 }
}
