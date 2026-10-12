import {randomBytes,randomUUID,createHash,scrypt as rawScrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(rawScrypt), lifetime=7*24*60*60;
const digest=s=>createHash('sha256').update(s).digest('hex');
const publicUser=u=>({id:u.id,email:u.email,created:u.created});
function reply(body,status=200,cookie){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Cookie',...(cookie?{'Set-Cookie':cookie}:{})}})}
function sessionCookie(token,maxAge=lifetime){return `__Host-stemlab=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`}
function token(req){return req.headers.get('cookie')?.match(/(?:^|;\s*)__Host-stemlab=([a-f0-9]{64})(?:;|$)/)?.[1]}
async function passwordHash(password,salt){return Buffer.from(await scrypt(password,salt,64,{N:16384,r:8,p:1})).toString('hex')}
export function createAccountHandler(storeFor,now=()=>Date.now()){
  return async function handle(req,context={}){
    try{
      const users=storeFor('stemlab-users'),sessions=storeFor('stemlab-auth'),limits=storeFor('stemlab-rate');
      async function user(){const value=token(req);if(!value)return null;const record=await sessions.get(digest(value),{type:'json'});if(!record)return null;if(record.expires<now()){await sessions.delete(digest(value));return null}return await users.get(record.userKey,{type:'json'})}
      if(req.method==='GET'){const u=await user();return u?reply({user:publicUser(u)}):reply({user:null},401)}
      if(req.method!=='POST')return reply({error:'Method not allowed'},405);
      if(req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'Request origin is not allowed'},403);
      if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Send a JSON request'},415);
      const text=await req.text();if(Buffer.byteLength(text)>8192)return reply({error:'Request is too large'},413);
      let input;try{input=JSON.parse(text)}catch{return reply({error:'Invalid request'},400)}
      if(!input||typeof input!=='object')return reply({error:'Invalid request'},400);
      if(input.action==='logout'){const t=token(req);if(t)await sessions.delete(digest(t));return reply({user:null},200,sessionCookie('',0))}
      if(!['signup','login'].includes(input.action))return reply({error:'Unknown account action'},400);
      // Atomic per-IP minute buckets. Netlify context.ip is supplied by the platform, not client headers.
      const bucket=digest((context.ip||'unknown')+':'+Math.floor(now()/60000));let allowed=false;
      for(let attempt=0;attempt<5;attempt++){
        const old=await limits.getWithMetadata(bucket,{type:'json'});
        const count=old?.data?.count||0;if(count>=15)return reply({error:'Too many attempts. Please wait a minute.'},429);
        const result=await limits.setJSON(bucket,{count:count+1},{...(old?{onlyIfMatch:old.etag}:{onlyIfNew:true})});
        if(result.modified){allowed=true;break}
      }
      if(!allowed)return reply({error:'Please wait a moment and try again.'},429);
      const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
      const password=input.password;
      if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<8||password.length>128)return reply({error:'Use a valid email and a password of 8–128 characters.'},400);
      const key=digest(email);let u=await users.get(key,{type:'json'});
      if(input.action==='signup'){
        const salt=randomBytes(16).toString('hex');const hash=await passwordHash(password,salt);
        const newUser={id:randomUUID(),email,salt,hash,created:now()};
        const result=await users.setJSON(key,newUser,{onlyIfNew:true});
        if(!result.modified)return reply({error:'An account with this email already exists. Please log in.'},409);
        u=newUser;
      }else{
        const computed=await passwordHash(password,u?.salt||'b869cb4ec2b4f3019cce29d801b37691');
        const expected=Buffer.from(u?.hash||'0'.repeat(128),'hex');
        if(!u||!timingSafeEqual(Buffer.from(computed,'hex'),expected))return reply({error:'Email or password is incorrect.'},401);
      }
      const oldToken=token(req);if(oldToken)await sessions.delete(digest(oldToken));
      const t=randomBytes(32).toString('hex');await sessions.setJSON(digest(t),{userKey:key,expires:now()+lifetime*1000});
      return reply({user:publicUser(u)},input.action==='signup'?201:200,sessionCookie(t));
    }catch(err){console.error('StemLab account request failed:',err.name);return reply({error:'Account service is temporarily unavailable. Please try again.'},503)}
  }
}
