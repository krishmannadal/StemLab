export function inferencePolicy(device){
  const ua=device.userAgent||'';
  const mobile=Boolean(device.userAgentData?.mobile)||/Android|iPhone|iPad|iPod/i.test(ua)||(/MacIntel|Macintosh/.test(device.platform||ua)&&(device.maxTouchPoints||0)>1);
  if(mobile)return{allowed:false,maxSeconds:0,message:'Neural separation is currently available on laptops and desktops to avoid phone-browser crashes. Open StemLab in Chrome or Edge on a computer. You can still use the demo mixer on this phone.'};
  const memory=Number(device.deviceMemory)||0;
  if(memory&&memory<8)return{allowed:false,maxSeconds:0,message:'This browser reports limited memory for the neural model. Use a computer with at least 8 GB RAM. The demo mixer is still available here.'};
  return{allowed:true,maxSeconds:30,message:'For neural separation, use Chrome or Edge on a laptop/desktop and a clip up to 30 seconds. The demo mixer also works on phones.'};
}
