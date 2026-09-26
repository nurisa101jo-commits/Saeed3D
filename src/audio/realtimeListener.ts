export class RealtimeListener{
 private stream?:MediaStream;
 private ctx?:AudioContext;
 private source?:MediaStreamAudioSourceNode;
 private processor?:ScriptProcessorNode;
 private stopped=false;
 private onChunk?:(base64:string)=>void;
 private onSpeechStart?:()=>void;
 private speechActive=false;
 private onStop?:(reason?:string)=>void;
 async start(onChunk:(base64:string)=>void,onStop?:()=>void,onSpeechStart?:()=>void){
  this.stopped=false;this.onChunk=onChunk;this.onStop=onStop;this.onSpeechStart=onSpeechStart;this.speechActive=false;
  this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
  this.ctx=new AudioContext({sampleRate:24000});
  await this.ctx.resume();
  this.source=this.ctx.createMediaStreamSource(this.stream);
  this.processor=this.ctx.createScriptProcessor(4096,1,1);
  this.processor.onaudioprocess=e=>{if(this.stopped)return;const input=e.inputBuffer.getChannelData(0);let sum=0;for(let i=0;i<input.length;i++)sum+=input[i]*input[i];const rms=Math.sqrt(sum/input.length);if(rms>0.035&&!this.speechActive){this.speechActive=true;this.onSpeechStart?.()}else if(rms<0.02)this.speechActive=false;const pcm=new Int16Array(input.length);for(let i=0;i<input.length;i++){const v=Math.max(-1,Math.min(1,input[i]));pcm[i]=v<0?v*0x8000:v*0x7fff}const bytes=new Uint8Array(pcm.buffer);let binary='';const step=0x8000;for(let i=0;i<bytes.length;i+=step)binary+=String.fromCharCode(...bytes.subarray(i,i+step));this.onChunk?.(btoa(binary))};
  this.source.connect(this.processor);this.processor.connect(this.ctx.destination);
 }
 stop(){if(this.stopped)return;this.stopped=true;try{this.processor?.disconnect()}catch{}try{this.source?.disconnect()}catch{}this.stream?.getTracks().forEach(t=>t.stop());this.stream=undefined;const c=this.ctx;this.ctx=undefined;if(c)void c.close().catch(()=>{});this.processor=undefined;this.source=undefined;this.onChunk=undefined;this.onSpeechStart=undefined;this.speechActive=false;this.onStop?.();this.onStop=undefined}
}
