import {createVoiceSource} from './voice.mjs';
import {defaults,cleanSettings} from './tuning-settings.mjs';
export {defaults,controls,cleanSettings,voicePresets,voiceRequest,interpretPrompt} from './tuning-settings.mjs';
export async function processAudio(buffer,value){const s=cleanSettings(value);if(Object.keys(defaults).every(k=>s[k]===0))return buffer;
 const ctx=new OfflineAudioContext(2,buffer.length,buffer.sampleRate);let source;if(s.pitch||s.formant){source=await createVoiceSource(ctx,buffer,s)}else{source=ctx.createBufferSource();source.buffer=buffer}let last=source;
 for(const [type,freq,gain] of [['lowshelf',200,s.low],['peaking',2500,s.mid],['highshelf',6500,s.high]]){const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=.7;f.gain.value=gain;last.connect(f);last=f}
 if(s.compression){const c=ctx.createDynamicsCompressor();c.threshold.value=-12-s.compression*.24;c.ratio.value=1+s.compression*.09;c.knee.value=20;c.attack.value=.01;c.release.value=.18;last.connect(c);last=c}
 const pan=ctx.createStereoPanner();pan.pan.value=s.pan/100;last.connect(pan);const dry=ctx.createGain();dry.gain.value=1-s.reverb/100;pan.connect(dry).connect(ctx.destination);
 if(s.reverb){const conv=ctx.createConvolver(),imp=ctx.createBuffer(2,Math.round(ctx.sampleRate*.8),ctx.sampleRate);let seed=17;for(let c=0;c<2;c++){const data=imp.getChannelData(c);for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=(seed/4294967296*2-1)*Math.pow(1-i/data.length,3)}}conv.buffer=imp;const wet=ctx.createGain();wet.gain.value=s.reverb/100;pan.connect(conv).connect(wet).connect(ctx.destination)}
 try{await source.start(0);const result=await ctx.startRendering();let peak=0;for(let c=0;c<2;c++)for(const x of result.getChannelData(c))peak=Math.max(peak,Math.abs(x));if(peak>.99)for(let c=0;c<2;c++){const a=result.getChannelData(c);for(let i=0;i<a.length;i++)a[i]*=.99/peak}return result}finally{source.disconnect();source.port?.close()}
}
