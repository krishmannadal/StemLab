import * as tf from '@tensorflow/tfjs';
import {MusicRNN} from '@magenta/music/es6/music_rnn.js';
self.onmessage=async({data})=>{let model;try{
 const {seed,steps,temperature,instrument}=data;if(!['drums','flute','bass','keys','piano','electric-guitar','violin'].includes(instrument)||![16,32,64].includes(steps)||temperature<.3||temperature>1.2)throw Error('Invalid composition settings.');
 self.postMessage({type:'progress',message:'Loading the small music composer (about 12 MB on first use)…'});await tf.setBackend('cpu');await tf.ready();
 model=new MusicRNN('/composer/v1/'+(instrument==='drums'?'drum_kit_rnn':'basic_rnn'));await model.initialize();self.postMessage({type:'progress',message:'Composing a new phrase with MusicRNN…'});
 const sequence=await model.continueSequence(seed,steps,temperature);model.dispose();model=null;self.postMessage({type:'result',sequence});
 }catch(e){self.postMessage({type:'error',message:e.message||'Music generation failed. Try again.'})}finally{model?.dispose()}};

