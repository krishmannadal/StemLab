import * as ort from 'onnxruntime-web/webgpu';
import {ONNXHTDemucs} from '../../node_modules/demucs/dist/onnx-htdemucs.js';
import {separateTracks} from '../../node_modules/demucs/dist/apply.js';
import {assembleWeights} from './model-loader.mjs';
import {inferencePolicy} from './inference-policy.mjs';
let model;
async function getModel(){
  if(model)return model;
  const policy=inferencePolicy(navigator);if(!policy.allowed)throw Error(policy.message);
  ort.env.wasm.wasmPaths=self.location.origin+'/';ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
  const response=await fetch('/model/manifest.json');if(!response.ok)throw Error('Model manifest could not be loaded.');
  const manifest=await response.json();let cache;try{cache=await caches.open('stemlab-model-v2')}catch{}
  let modelData=await assembleWeights(manifest,async name=>{
    const url='/model/'+name;let part=cache?await cache.match(url):null;
    if(!part){part=await fetch(url);if(!part.ok)throw Error('The model could not be downloaded. Check your connection.');if(cache)try{await cache.put(url,part.clone())}catch{/* Cache quota is optional; inference can continue. */}}
    if(!part.ok)throw Error('The model could not be downloaded.');return part.arrayBuffer();
  },(done,total)=>self.postMessage({type:'progress',message:`Downloading neural model · ${Math.round(done/total*100)}%`}));
  self.postMessage({type:'progress',message:'Preparing the neural model. This may take a moment.'});
  model=new ONNXHTDemucs();model.session=await ort.InferenceSession.create(modelData,{executionProviders:['wasm'],enableCpuMemArena:false,enableMemPattern:false});
  modelData=null;model.inputNames=model.session.inputNames;model.outputNames=model.session.outputNames;return model;
}
self.onmessage=async event=>{
  try{
    const policy=inferencePolicy(navigator);if(!policy.allowed)throw Error(policy.message);
    const channels=event.data.channels,sr=44100;
    if(!Array.isArray(channels)||channels.length!==2||channels[0].length!==channels[1].length||channels[0].length<sr||channels[0].length>sr*policy.maxSeconds)throw Error('Use a stereo clip between 1 and 30 seconds.');
    const m=await getModel();let mean=0;
    for(let i=0;i<channels[0].length;i++)mean+=(channels[0][i]+channels[1][i])/2;mean/=channels[0].length;
    let variance=0;for(let i=0;i<channels[0].length;i++){const x=(channels[0][i]+channels[1][i])/2-mean;variance+=x*x}
    const std=Math.max(1e-8,Math.sqrt(variance/Math.max(1,channels[0].length-1)));
    // Normalize transferred input in place rather than keeping another audio copy.
    for(const channel of channels)for(let i=0;i<channel.length;i++)channel[i]=(channel[i]-mean)/std;
    const result=await separateTracks(m,{channelData:channels,sampleRate:sr},(step,total)=>self.postMessage({type:'progress',message:`Separating the layers · ${Math.round(step/total*100)}%`}));
    const transfer=[];
    for(const value of Object.values(result))for(const channel of value.channelData){for(let i=0;i<channel.length;i++)channel[i]=channel[i]*std+mean;transfer.push(channel.buffer)}
    self.postMessage({type:'result',parts:result,backend:'WASM / CPU'},[...new Set(transfer)]);
  }catch(err){self.postMessage({type:'error',message:err.message||'Separation failed. Try a shorter clip on a computer.'})}
};
