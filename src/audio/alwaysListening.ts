export class AlwaysListener{
private stream?:MediaStream;private timer?:number;private chunks:Blob[]=[];private recording=false;private speech=false;private lastVoice=0;private callback?:((b:Blob)=>Promise<void>);
private rec?:MediaRecorder;private pending?:Blob;private analyserCtx?:AudioContext;private stopped=false;

private async ensureStream(){
  if(this.stream)return;
  this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
}
async start(onUtterance:(b:Blob)=>Promise<void>){
  this.stopped=false;this.callback=onUtterance;await this.ensureStream();
  const stream=this.stream;if(!stream)throw new Error('Microphone stream is unavailable');const analyser=new AudioContext();this.analyserCtx=analyser;const src=analyser.createMediaStreamSource(stream);const a=analyser.createAnalyser();a.fftSize=1024;src.connect(a);const data=new Uint8Array(a.fftSize);
  const loop=()=>{if(this.stopped)return;a.getByteTimeDomainData(data);let sum=0;for(const v of data){const d=(v-128)/128;sum+=d*d}const rms=Math.sqrt(sum/data.length);const now=performance.now();if(rms>.035){this.speech=true;this.lastVoice=now;if(!this.recording)this.begin()}else if(this.recording&&this.speech&&now-this.lastVoice>900)this.finish();this.timer=requestAnimationFrame(loop)};loop();
}
async startManual(onUtterance:(b:Blob)=>Promise<void>){
  this.callback=onUtterance;await this.ensureStream();if(!this.recording)this.begin();
}
stopManual(){if(this.recording)this.finish();}

private begin(){
  if(!this.stream||this.recording)return;
  this.chunks=[];this.recording=true;this.speech=true;
  const r=new MediaRecorder(this.stream,{mimeType:MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm'});
  this.rec=r;r.ondataavailable=e=>{if(e.data.size)this.chunks.push(e.data)};
  r.onstop=()=>{this.pending=new Blob(this.chunks,{type:r.mimeType});this.recording=false;this.speech=false;const b=this.pending;this.pending=undefined;if(b&&this.callback)void this.callback(b)};
  r.start();
}
private finish(){if(!this.rec)return;const r=this.rec;this.rec=undefined;r.stop();}
stop(){this.stopped=true;if(this.timer)cancelAnimationFrame(this.timer);this.timer=undefined;if(this.recording)this.finish();this.stream?.getTracks().forEach(t=>t.stop());this.stream=undefined;this.callback=undefined;const c=this.analyserCtx;this.analyserCtx=undefined;if(c)void c.close().catch(()=>{});this.speech=false;this.lastVoice=0;}
}