// Foreground energy is a proxy, not a singing VAD. Complete clips permit bidirectional inference.
import weights from './phrase-planner-weights.json' with {type:'json'};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const MODEL_INFO={version:weights.version,training:weights.training,architecture:weights.architecture};
export function parseIntervals(text,duration){
 if(!text.trim())return [];
 const result=text.split(/[,;\n]+/).filter(x=>x.trim()).map(part=>{const m=part.trim().match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);if(!m)throw Error('Use lead intervals such as 0.5-2.8, 4-6.2 (seconds).');const a=+m[1],b=+m[2];if(a<0||b<=a||b>duration+.001)throw Error('Lead intervals must fit inside the session.');return [a,b]}).sort((a,b)=>a[0]-b[0]);
 const merged=[];for(const p of result){if(merged.length&&p[0]<=merged.at(-1)[1])merged.at(-1)[1]=Math.max(p[1],merged.at(-1)[1]);else merged.push(p)}return merged;
}
export function detectLead(buffer,{offset=0,duration=buffer.duration+offset,thresholdDb=-32}={}){
 const hop=.02,n=Math.ceil(duration/hop),rms=new Float32Array(n),channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
 for(let i=0;i<n;i++){let sum=0,count=0;const a=Math.max(0,Math.floor((i*hop-offset)*buffer.sampleRate)),b=Math.min(buffer.length,Math.floor(((i+1)*hop-offset)*buffer.sampleRate));if((i+1)*hop<=offset)continue;for(let j=a;j<b;j+=4)for(const c of channels){sum+=c[j]**2;count++}rms[i]=Math.sqrt(sum/Math.max(1,count))}
 const peak=Math.max(...rms),threshold=Math.max(.0001,peak*10**(thresholdDb/20)),active=Array.from(rms,x=>x>threshold),raw=[];let begin=null;
 for(let i=0;i<=n;i++){if(active[i]&&begin===null)begin=i*hop;if(!active[i]&&begin!==null){if(i*hop-begin>=.06)raw.push([begin,Math.min(duration,i*hop)]);begin=null}}
 const intervals=[];for(const p of raw){if(intervals.length&&p[0]-intervals.at(-1)[1]<.16)intervals.at(-1)[1]=p[1];else intervals.push(p)}
 return {intervals,peak,hop,rms:Array.from(rms),silent:peak<.0001};
}
export function makeFeatures({intervals,duration,bpm=120,phase=0,margin=.12,background=[]}){
 const step=60/bpm/2,origin=((phase%step)+step)%step,n=Math.max(0,Math.floor((duration-origin)/step)),mask=Array.from({length:n},(_,i)=>intervals.some(([a,b])=>origin+i*step<b+margin&&origin+(i+1)*step>a-margin)?1:0),peak=Math.max(.0001,...background);
 return {step,origin,mask,features:mask.map((active,i)=>{const t=origin+(i+.5)*step,beat=(t-phase)/(60/bpm),bg=background.length?background[Math.min(background.length-1,Math.floor(t/.02))]/peak:0;return [active,bg,Math.sin(beat*Math.PI/2),Math.cos(beat*Math.PI/2),i/Math.max(1,n-1)]})};
}
const sigmoid=x=>1/(1+Math.exp(-clamp(x,-40,40)));
// PyTorch GRU gate order r,z,n.
export function inferPlanner(features,model=weights){
 const H=model.hidden,run=(suffix,reverse)=>{let h=Array(H).fill(0),out=Array(features.length);const wi=model.state['gru.weight_ih_l0'+suffix],wh=model.state['gru.weight_hh_l0'+suffix],bi=model.state['gru.bias_ih_l0'+suffix],bh=model.state['gru.bias_hh_l0'+suffix];
 for(let k=0;k<features.length;k++){const t=reverse?features.length-1-k:k,x=features[t],a=wi.map((row,i)=>row.reduce((s,w,j)=>s+w*x[j],bi[i])),b=wh.map((row,i)=>row.reduce((s,w,j)=>s+w*h[j],bh[i]));h=h.map((old,i)=>{const r=sigmoid(a[i]+b[i]),z=sigmoid(a[H+i]+b[H+i]),candidate=Math.tanh(a[2*H+i]+r*b[2*H+i]);return (1-z)*candidate+z*old});out[t]=h.slice()}return out};
 const forward=run('',false),backward=run('_reverse',true);return features.map((_,i)=>{const h=[...forward[i],...backward[i]];return model.state['head.weight'].map((row,j)=>sigmoid(row.reduce((s,w,k)=>s+w*h[k],model.state['head.bias'][j])))})
}
const overlaps=(a,b,intervals)=>intervals.some(([x,y])=>a<y&&b>x);
export function planPhrases({intervals,duration,bpm=120,phase=0,density=.25,margin=.12,background=[],method='learned'}){
 if(!Number.isFinite(duration)||duration<=0||duration>30||!Number.isFinite(bpm)||bpm<60||bpm>200||!Number.isFinite(density)||density<.05||density>.75||!Number.isFinite(margin)||margin<0||margin>1)throw Error('Invalid phrase planning controls.');
 const grid=makeFeatures({intervals,duration,bpm,phase,margin,background}),predictions=inferPlanner(grid.features),budget=Math.floor(duration*density/grid.step),blocked=Array(grid.mask.length).fill(false),candidates=[];
 for(let i=0;i<grid.mask.length;i++)for(const size of [2,4,8]){const start=grid.origin+i*grid.step,end=grid.origin+(i+size)*grid.step;if(end>duration||overlaps(start,end,intervals.map(([a,b])=>[Math.max(0,a-margin),b+margin])))continue;
 const p=predictions[i],since=intervals.reduce((v,[,b])=>b<=start?Math.min(v,start-b):v,10),score=method==='learned'?p[0]+.25*(1-Math.abs(p[1]-size/8))+.15*p[2]-.02*since:1/(1+since);candidates.push({start,end,size,index:i,intensity:method==='learned'?clamp(p[2],.35,.9):.65,score})}
 candidates.sort((a,b)=>b.score-a.score||a.start-b.start||b.size-a.size);const phrases=[];let used=0;
 for(const c of candidates){if(used+c.size>budget||blocked.slice(c.index,c.index+c.size).some(Boolean))continue;phrases.push({start:c.start,end:c.end,intensity:c.intensity});used+=c.size;for(let i=Math.max(0,c.index-1);i<Math.min(blocked.length,c.index+c.size+1);i++)blocked[i]=true}
 phrases.sort((a,b)=>a.start-b.start);return {phrases,requestedDensity:density,achievedDensity:used*grid.step/duration,shortfallSeconds:Math.max(0,duration*density-used*grid.step),budgetSeconds:budget*grid.step,model:MODEL_INFO,step:grid.step};
}
// Time-scale a complete motif into each planned window; reserve the synthesis release tail.
export function phraseEvents(motif,phrases){
 if(!motif.length)return [];const first=Math.min(...motif.map(n=>n.time)),length=Math.max(...motif.map(n=>n.time+n.duration))-first;if(length<=0)return [];
 return phrases.flatMap((p,index)=>{const available=Math.max(.01,p.end-p.start-.15),scale=available/length;return motif.map(n=>({...n,time:p.start+(n.time-first)*scale,duration:Math.min(2,n.duration*scale),velocity:n.velocity*p.intensity,phrase:index}))});
}
export function continuousPhrases(duration,length=1){const out=[];for(let start=0;start+length<=duration+.000001;start+=length)out.push({start,end:start+length,intensity:.65});return out}
export function muteLead(samples,sampleRate,intervals,margin=0){const out=samples.slice(),fade=.012;for(const[a,b]of intervals){const lo=Math.max(0,Math.floor((a-margin-fade)*sampleRate)),hi=Math.min(out.length,Math.ceil((b+margin+fade)*sampleRate));for(let i=lo;i<hi;i++){const t=i/sampleRate,g=t<a-margin?clamp((a-margin-t)/fade,0,1):t>b+margin?clamp((t-b-margin)/fade,0,1):0;out[i]*=g}}return out}
export function measurePlan(phrases,intervals,duration){let overlap=0,total=0,cut=0;const distances=[];for(const p of phrases){total+=p.end-p.start;let hit=false;for(const[a,b]of intervals){overlap+=Math.max(0,Math.min(p.end,b)-Math.max(p.start,a));if((a>p.start&&a<p.end)||(b>p.start&&b<p.end))hit=true}if(hit)cut++;if(intervals.length)distances.push(Math.min(...intervals.flatMap(([a,b])=>[Math.abs(p.start-b),Math.abs(p.end-a)])))}return {phraseCount:phrases.length,phraseDensity:total/duration,overlapSeconds:overlap,interruptedPhrases:cut,meanBoundaryClearance:distances.length?distances.reduce((a,b)=>a+b,0)/distances.length:null}}
export function audibleSeconds(samples,sr){let count=0;for(const x of samples)if(Math.abs(x)>1e-4)count++;return count/sr}
