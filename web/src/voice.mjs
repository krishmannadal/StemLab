// Signalsmith Stretch performs independent pitch/formant shifting at rate 1.
// Buffer mode compensates processing latency so the rendered track stays on the remix timeline.
let library;
export async function createVoiceSource(context,buffer,{pitch,formant}){
 if(!context.audioWorklet||typeof AudioWorkletNode==='undefined')throw Error('Vocal transformation needs AudioWorklet support. Open StemLab over HTTPS in a current Chrome or Edge browser.');
 library??=import('/voice/SignalsmithStretch-1.3.2.mjs').catch(error=>{library=null;throw error});
 const {default:Stretch}=await library;let timer,node;
 try{
  const ready=Stretch(context,{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
  node=await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The vocal processor did not start. Refresh and try again.')),20000)})]);
  clearTimeout(timer);
  node.onprocessorerror=()=>{node.port.close()};
  const channels=[buffer.getChannelData(0).slice(),buffer.getChannelData(Math.min(1,buffer.numberOfChannels-1)).slice()];
  await node.addBuffers(channels,channels.map(a=>a.buffer));
  await node.schedule({output:0,input:0,rate:1,semitones:pitch,formantSemitones:formant,formantCompensation:true,formantBaseHz:0});
  return node;
 }catch(error){node?.disconnect();node?.port.close();throw error}finally{clearTimeout(timer)}
}
