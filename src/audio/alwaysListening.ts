export class AlwaysListener{
private stream?:MediaStream; private timer?:number; private chunks:Blob[]=[]; private recording=false; private speech=false; private lastVoice=0;
async start(onUtterance:(b:Blob)=>Promise<void>){
 this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
 const analyser=new AudioContext(); const src=analyser.createMediaStreamSource(this.stream); const a=analyser.createAnalyser();a.fftSize=1024;src.connect(a); const data=new Uint8Array(a.fftSize);
 const loop=()=>{a.getByteTimeDomainData(data);let sum=0;for(const v of data){const d=(v-128)/128;sum+=d*d}const rms=Math.sqrt(sum/data.length);const now=performance.now();if(rms>.035){this.speech=true;this.lastVoice=now;if(!this.recording)this.begin()}else if(this.recording&&this.speech&&now-this.lastVoice>900)this.finish(onUtterance);this.timer=requestAnimationFrame(loop)};loop();
}
private begin(){this.chunks=[];this.recording=true;const r=new MediaRecorder(this.stream!,{mimeType:MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm'});(r as any)._s=r;r.ondataavailable=e=>{if(e.data.size)this.chunks.push(e.data)};r.onstop=()=>{const b=new Blob(this.chunks,{type:r.mimeType});this.recording=false;this.speech=false;(this as any).pending=b};r.start();(this as any).rec=r}
private finish(onUtterance:(b:Blob)=>Promise<void>){const r=(this as any).rec as MediaRecorder|undefined;if(!r)return;r.stop();const poll=()=>{const b=(this as any).pending as Blob|undefined;if(!b){setTimeout(poll,20);return}(this as any).pending=undefined;onUtterance(b)};setTimeout(poll,30)}
stop(){if(this.timer)cancelAnimationFrame(this.timer);this.stream?.getTracks().forEach(t=>t.stop());this.stream=undefined}
}