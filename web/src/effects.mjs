export const defaults={low:0,mid:0,high:0,compression:0,reverb:0,pan:0};
export const controls=[['low','Bass / warmth',-12,12,1,' dB'],['mid','Presence',-12,12,1,' dB'],['high','Air / brightness',-12,12,1,' dB'],['compression','Compression',0,100,1,'%'],['reverb','Room reverb',0,50,1,'%'],['pan','Stereo position',-100,100,1,'']];
export function cleanSettings(value={}){return Object.fromEntries(controls.map(([k,,min,max])=>[k,Math.max(min,Math.min(max,Number(value[k])||0))]))}
export function interpretPrompt(text){const p=text.toLowerCase(),s={...defaults};let matched=false;const set=v=>{Object.assign(s,v);matched=true};
 if(/lata|vintage|classic|retro/.test(p))set({low:-2,mid:2,high:3,compression:25,reverb:14});
 if(/warm|deep|full/.test(p))set({low:4,high:-2});
 if(/bright|clear|airy|crisp/.test(p))set({low:-2,mid:2,high:4,compression:20});
 if(/punch|drum|tight/.test(p))set({low:3,mid:2,compression:45});
 if(/soft|smooth|gentle/.test(p))set({high:-2,compression:30});
 if(/room|space|reverb|dream/.test(p))set({reverb:25});
 if(/dry|no reverb/.test(p))set({reverb:0});
 if(/telephone|radio/.test(p))set({low:-12,mid:6,high:-12,compression:40});
 if(/reset|natural|original/.test(p))set(defaults);
 return {settings:s,matched,message:/lata/.test(p)?'Applied a bright vintage vocal treatment inspired by your description. Effects do not recreate the singer’s voice.':'Applied local preset suggestions. Adjust the sliders to taste.'};
}
export async function processAudio(buffer,value){const s=cleanSettings(value);if(Object.keys(defaults).every(k=>s[k]===0))return buffer;
 const ctx=new OfflineAudioContext(2,buffer.length,buffer.sampleRate),source=ctx.createBufferSource();source.buffer=buffer;let last=source;
 for(const [type,freq,gain] of [['lowshelf',200,s.low],['peaking',2500,s.mid],['highshelf',6500,s.high]]){const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=.7;f.gain.value=gain;last.connect(f);last=f}
 if(s.compression){const c=ctx.createDynamicsCompressor();c.threshold.value=-12-s.compression*.24;c.ratio.value=1+s.compression*.09;c.knee.value=20;c.attack.value=.01;c.release.value=.18;last.connect(c);last=c}
 const pan=ctx.createStereoPanner();pan.pan.value=s.pan/100;last.connect(pan);const dry=ctx.createGain();dry.gain.value=1-s.reverb/100;pan.connect(dry).connect(ctx.destination);
 if(s.reverb){const conv=ctx.createConvolver(),imp=ctx.createBuffer(2,Math.round(ctx.sampleRate*.8),ctx.sampleRate);let seed=17;for(let c=0;c<2;c++){const data=imp.getChannelData(c);for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*Math.pow(1-i/data.length,3)}}conv.buffer=imp;const wet=ctx.createGain();wet.gain.value=s.reverb/100;pan.connect(conv).connect(wet).connect(ctx.destination)}
 source.start();const result=await ctx.startRendering();let peak=0;for(let c=0;c<2;c++)for(const x of result.getChannelData(c))peak=Math.max(peak,Math.abs(x));if(peak>.99)for(let c=0;c<2;c++){const a=result.getChannelData(c);for(let i=0;i<a.length;i++)a[i]*=.99/peak}return result;
}
