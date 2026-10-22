export const defaults={low:0,mid:0,high:0,compression:0,reverb:0,pan:0,pitch:0,formant:0};
export const controls=[['pitch','Vocal pitch',-12,12,.5,' st'],['formant','Vocal resonance / formants',-8,8,.5,' st'],['low','Bass / warmth',-12,12,1,' dB'],['mid','Presence',-12,12,1,' dB'],['high','Air / brightness',-12,12,1,' dB'],['compression','Compression',0,100,1,'%'],['reverb','Room reverb',0,50,1,'%'],['pan','Stereo position',-100,100,1,'']];
export function cleanSettings(value={}){return Object.fromEntries(controls.map(([k,,min,max,step])=>{const n=Number(value?.[k]);return[k,Number.isFinite(n)?Math.round(Math.max(min,Math.min(max,n))/step)*step:0]}))}
export const voicePresets={
 feminine:{label:'Feminine voice',settings:{...defaults,pitch:5,formant:3,low:-2,mid:1,high:2,compression:20}},
 masculine:{label:'Masculine voice',settings:{...defaults,pitch:-4,formant:-2,low:2,compression:20}},
 lighter:{label:'Lighter voice · same notes',settings:{...defaults,formant:3,low:-2,high:2,compression:15}}
};
// Match the requested destination ("female to male" ends in male), not a substring of female.
export function voiceRequest(text){const p=text.toLowerCase();if(/\b(don't|do not|without|not to|avoid)\b|\b(what|why|explain|difference|how does|how do)\b/.test(p))return null;const targets=[...p.matchAll(/\b(female|feminine|woman|girl|male|masculine|man|boy)\b/g)];if(!targets.length)return null;const target=targets.at(-1)[1],type=/^(female|feminine|woman|girl)$/.test(target)?'feminine':'masculine';const settings={...voicePresets[type].settings};if(/same (notes|pitch)|keep (the )?(notes|pitch)|formant.only/.test(p))settings.pitch=0;const pitch=p.match(/(?:pitch\s*(?:by|to|:)?\s*)([+-]?\d+(?:\.\d+)?)\s*(?:st|semitones?)?/),formant=p.match(/formants?\s*(?:by|to|:)?\s*([+-]?\d+(?:\.\d+)?)/);if(pitch)settings.pitch=Number(pitch[1]);if(formant)settings.formant=Number(formant[1]);return{settings:cleanSettings(settings),type,message:'Try this '+type+' vocal starting point: pitch '+settings.pitch+' semitones and resonance '+settings.formant+' semitones. Apply it to hear the transformation. Duration stays the same. Adjust by ear; results depend on your recording. Use pitch 0 to keep the original melody.'}}
export function interpretPrompt(text){const p=text.toLowerCase(),s={...defaults};let matched=false;const set=v=>{Object.assign(s,v);matched=true};
 const voice=voiceRequest(text);if(voice)return{...voice,matched:true};
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
