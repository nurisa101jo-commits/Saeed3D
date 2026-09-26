import {useEffect,useRef,useState} from 'react';
import {ConversationManager,runCommand} from '../../ai/chat';
import {buildPrompt} from '../../ai/prompts';
import {AlwaysListener} from '../../audio/alwaysListening';

async function decodeSpeechBlob(blob:Blob){
  const ctx=new AudioContext({sampleRate:16000});
  try{const decoded=await ctx.decodeAudioData(await blob.arrayBuffer());const mono=new Float32Array(decoded.length);for(let ch=0;ch<decoded.numberOfChannels;ch++){const d=decoded.getChannelData(ch);for(let i=0;i<decoded.length;i++)mono[i]+=d[i]/decoded.numberOfChannels}return{samples:mono,sampleRate:decoded.sampleRate}}
  finally{await ctx.close().catch(()=>{})}
}
type MicMode='always'|'push-to-talk'|'off';

export function Chat(){
 const[open,setOpen]=useState(false),[text,setText]=useState(''),[answer,setAnswer]=useState(''),[speechText,setSpeechText]=useState(''),[listening,setListening]=useState(false),[error,setError]=useState(''),[micMode,setMicMode]=useState<MicMode>('always'),[showResponse,setShowResponse]=useState(false);
 const listener=useRef<AlwaysListener|null>(null),pttDown=useRef(false),sending=useRef(false);

 async function speakOnce(t:string){
  if(!t.trim())return;
  try{const settings=await window.electronAPI.getSettings();if(settings?.config?.speakResponses===false)return;const b=await window.electronAPI.speak(t);const raw=atob(b);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const mime=settings?.config?.ttsProvider==='local'?'audio/wav':'audio/mpeg';const u=URL.createObjectURL(new Blob([bytes],{type:mime})),a=new Audio(u);await a.play();await new Promise(r=>{a.onended=()=>r(null);a.onerror=()=>r(null)});URL.revokeObjectURL(u)}catch(e){setError('Voice response error: '+String(e))}
 }
 async function send(q=text){
  const question=q.trim();if(!question||sending.current)return;sending.current=true;setText('');setAnswer('');setError('');
  try{
   if(await runCommand(question))return;
   const tool=await window.electronAPI.assistantTool(question);
   if(tool){setAnswer(tool);setShowResponse(true);await speakOnce(tool);return}
   const manager=new ConversationManager();let full='';
   await manager.run(buildPrompt(question),d=>{full+=d;setAnswer(full);setShowResponse(true)});
   if(full.trim())await speakOnce(full.trim());
  }catch(e){setError(String(e))}finally{sending.current=false}
 }
 async function handleUtterance(b:Blob){
  setListening(true);
  try{const webm=await b.arrayBuffer(),decoded=await decodeSpeechBlob(b),settings=await window.electronAPI.getSettings();const q=await window.electronAPI.transcribe({webm,samples:decoded.samples,sampleRate:decoded.sampleRate});if(q.trim()){if(settings?.config?.showSpeechText!==false)setSpeechText(q);await send(q)}}catch(e){setError('Speech recognition error: '+String(e))}finally{setListening(false)}
 }
 async function stopListener(){listener.current?.stop();listener.current=null;setListening(false);pttDown.current=false}
 async function startAlways(){await stopListener();if(micMode!=='always')return;try{const l=new AlwaysListener();listener.current=l;await l.start(handleUtterance)}catch(e){setError('Microphone permission error: '+String(e))}}
 async function pushStart(){if(micMode!=='push-to-talk'||listener.current||sending.current)return;try{const l=new AlwaysListener();listener.current=l;pttDown.current=true;setListening(true);await l.startManual(handleUtterance)}catch(e){pttDown.current=false;setListening(false);setError('Microphone permission error: '+String(e))}}
 function pushStop(){if(micMode==='push-to-talk'&&listener.current){listener.current.stopManual();pttDown.current=false;setListening(false)}}

 useEffect(()=>{window.electronAPI.getSettings().then(x=>{const m=(x.config?.micMode||(x.config?.alwaysListening===false?'off':'always')) as MicMode;setMicMode(m);setShowResponse(Boolean(x.config?.showSpeechText))});const a=window.electronAPI.onOpenChat(()=>setOpen(true));const b=window.electronAPI.onMicMode(setMicMode);const c=window.electronAPI.onTrayMicMode(m=>{setMicMode(m);void window.electronAPI.setMicMode(m)});return()=>{a();b();c();void stopListener()}},[]);
 useEffect(()=>{if(micMode==='always')void startAlways();else void stopListener()},[micMode]);
 useEffect(()=>{const d=(e:KeyboardEvent)=>{if(e.code==='Space'&&micMode==='push-to-talk'&&!(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)){e.preventDefault();if(!pttDown.current)void pushStart()}};const u=(e:KeyboardEvent)=>{if(e.code==='Space'&&pttDown.current){e.preventDefault();pushStop()}};window.addEventListener('keydown',d);window.addEventListener('keyup',u);return()=>{window.removeEventListener('keydown',d);window.removeEventListener('keyup',u)}},[micMode]);

 const ptt=micMode==='push-to-talk'?<button className={pttDown.current?'ptt active':'ptt'} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);void pushStart()}} onPointerUp={e=>{e.preventDefault();pushStop()}} onPointerCancel={pushStop} title="Hold to talk">🎙</button>:null;
 if(!open)return <>{showResponse&&answer&&<div className="saeedSpeechBubble">{answer}</div>}<button className="chatToggle" onClick={()=>setOpen(true)} title="Start chat">💬</button></>;
 return <>{showResponse&&answer&&<div className="saeedSpeechBubble">{answer}</div>}<div className="chat">
  <div className="chatHeader"><span>Chat with Saeed</span><button onClick={()=>setOpen(false)}>×</button></div>
  <div className="listen">{micMode==='off'?'○ Mic closed':micMode==='push-to-talk'?(listening?'● Recording — release':'○ Hold 🎙 to talk'):(listening?'● Listening':'○ Mic ready')}</div>
  {speechText&&<div className="speechText"><span>You said</span><div>{speechText}</div></div>}
  <div className="answer">{answer}</div>{error&&<div className="error">{error}</div>}
  <div className="row"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&void send()} placeholder="Talk to Saeed..."/>{ptt}<button onClick={()=>void send()}>Send</button></div>
 </div></>
}