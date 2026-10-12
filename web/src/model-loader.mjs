// Allocate one weights buffer; never retain a second full array of chunks.
export async function assembleWeights(manifest,getPart,onProgress=()=>{}){
  if(!Number.isSafeInteger(manifest.bytes)||manifest.bytes<=0||manifest.bytes>250*1024*1024||!Array.isArray(manifest.parts)||!manifest.parts.length)throw Error('Invalid model manifest.');
  const weights=new Uint8Array(manifest.bytes);let offset=0;
  for(const name of manifest.parts){
    if(!/^part-\d+\.bin$/.test(name))throw Error('Invalid model part.');
    const bytes=new Uint8Array(await getPart(name));
    if(!bytes.length||offset+bytes.length>weights.length)throw Error('Incomplete or invalid model download.');
    weights.set(bytes,offset);offset+=bytes.length;onProgress(offset,weights.length);
  }
  if(offset!==weights.length)throw Error('Incomplete model download. Reload and try again.');
  return weights;
}
