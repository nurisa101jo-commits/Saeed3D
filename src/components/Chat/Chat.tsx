import {useEffect,useRef,useState} from 'react';
import {ConversationManager,runCommand} from '../../ai/chat';
import {buildPrompt} from '../../ai/prompts';
import {AlwaysListener} from '../../audio/alwaysListening';

async function decodeSpeechBlob(blob:Blob){
  const ctx=new AudioContext({sampleRate:16000});
  try{
    const decoded=await ctx.decodeAudioData(await blob.arrayBuffer());
    const channels=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i));
    const mono=new Float32Array(decoded.length);
    for(const channel of channels)for(let i=0;i<decoded.length;i++)mono[i]+=channel[i]/channels.length;
    return{samples:mono,sampleRate:decoded.sampleRate};
  }finally{await ctx.close().catch(()=>{})}
}

type MicMode='always'|'push-to-talk'|'off';

export function Chat(){
  const[open,setOpen]=useState(false);const[text,setText]=useState('');const[answer,setAnswer]=useState('');const[speechText,setSpeechText]=useState('');
  const[listening,setListening]=useState(false);const[error,setError]=useState('');const[micMode,setMicMode]=useState<MicMode>('always');
  const listener=useRef<AlwaysListener|null>(null);const speakQueue=useRef(Promise.resolve());const pttDown=useRef(false);

  async function speak(t:string){
    if(!t.trim())return;
    speakQueue.current=speakQueue.current.then(async()=>{
      try{
        const settings=await window.electronAPI.getSettings();if(settings?.config?.speakResponses===false)return;
        const b=await window.electronAPI.speak(t);const raw=atob(b);const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
        const mime=settings?.config?.ttsProvider==='local'?'audio/wav':'audio/mpeg';const u=URL.createObjectURL(new Blob([bytes],{type:mime}));const a=new Audio(u);
        await a.play();await new Promise(r=>{a.onended=()=>r(null);a.onerror=()=>r(null)});URL.revokeObjectURL(u);
      }catch(e){setError('Voice response error: '+String(e))}
    })
  }

  async function send(q=text){
    if(!q.trim())return;setText('');setAnswer('');setError('');if(await runCommand(q))return;
    const manager=new ConversationManager();let sentence='';
    await manager.run(buildPrompt(q),d=>{setAnswer(x=>x+d);sentence+=d;if(/[.!?؟]\s*$/.test(sentence)){const s=sentence;sentence='';void speak(s)}}).then(()=>{if(sentence.trim())void speak(sentence)}).catch(e=>setError(String(e)));
  }

  async function handleUtterance(b:Blob){
    setListening(true);
    try{
      const webm=await b.arrayBuffer();const decoded=await decodeSpeechBlob(b);const settings=await window.electronAPI.getSettings();
      const q=await window.electronAPI.transcribe({webm,samples:decoded.samples,sampleRate:decoded.sampleRate});
      if(q){if(settings?.config?.showSpeechText!==false)setSpeechText(q);await send(q)}
    }catch(e){setError('Speech recognition error: '+String(e))}
    finally{setListening(false)}
  }

  async function stopListener(){if(listener.current){listener.current.stop();listener.current=null}setListening(false)}
  async function startAlways(){
    await stopListener();if(micMode!=='always')return;
    try{const l=new AlwaysListener();listener.current=l;await l.start(handleUtterance)}catch(e){setError('Microphone permission is required by Windows: '+String(e))}
  }
  async function pushStart(){
    if(micMode!=='push-to-talk'||listener.current)return;
    try{const l=new AlwaysListener();listener.current=l;await l.startManual(handleUtterance);setListening(true)}catch(e){setError('Microphone permission is required by Windows: '+String(e))}
  }
  async function pushStop(){if(micMode==='push-to-talk'&&listener.current){listener.current.stopManual();setListening(false);}}

  useEffect(()=>{
    window.electronAPI.getSettings().then(x=>{const m=(x.config?.micMode||(x.config?.alwaysListening===false?'off':'always')) as MicMode;setMicMode(m);});
    const offOpen=window.electronAPI.onOpenChat(()=>setOpen(true));
    const offMode=window.electronAPI.onMicMode((m)=>{if(m!==micMode){setMicMode(m);void window.electronAPI.setMicMode(m)}});
    return()=>{offOpen();offMode();void stopListener()};
  },[]);

  useEffect(()=>{if(micMode==='always')void startAlways();else void stopListener();},[micMode]);

  useEffect(()=>{
    if(micMode!=='push-to-talk')return;
    const down=(e:KeyboardEvent)=>{if(e.code==='Space'&&!(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)){e.preventDefault();if(!pttDown.current){pttDown.current=true;void pushStart()}}};
    const up=(e:KeyboardEvent)=>{if(e.code==='Space'&&pttDown.current){e.preventDefault();pttDown.current=false;void pushStop()}};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)};
  },[micMode]);

  if(!open)return <button className="chatToggle" onClick={()=>setOpen(true)} title="Start chat">💬</button>;

  return <div className="chat">
    <div className="chatHeader"><span>Chat with Saeed</span><button onClick={()=>setOpen(false)} title="Close chat">×</button></div>
    <div className="listen">{micMode==='off'?'○ Mic closed':micMode==='push-to-talk'?(listening?'● Listening — release Space':'○ Hold Space to talk'):(listening?'● Listening':'○ Mic ready')}</div>
    {speechText&&<div className="speechText"><span>You said</span><div>{speechText}</div></div>}
    <div className="answer">{answer}</div>{error&&<div className="error">{error}</div>}
    <div className="row"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Talk to Saeed..."/><button onClick={()=>send()}>Send</button></div>
  </div>
}