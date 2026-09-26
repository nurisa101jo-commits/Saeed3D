import {useEffect,useState} from 'react';

type S={
  llmProvider:string;llm:any;sttProvider:'local'|'openai';sttModel:string;sttLanguage:string;
  ttsProvider:'local'|'openai'|'azure';tts:any;language:string;alwaysListening:boolean;
  micMode:'always'|'push-to-talk'|'off';
  brainMode:'auto'|'local'|'api';showSpeechText:boolean;speakResponses:boolean;
};
const defaults:S={
  llmProvider:'openai',llm:{model:'gpt-5'},sttProvider:'local',sttModel:'gpt-4o-mini-transcribe',
  sttLanguage:'en',ttsProvider:'local',tts:{model:'gpt-4o-mini-tts',voice:'alloy',modelFile:'en_US-lessac-medium.onnx',tokensFile:'tokens.txt',dataDir:'espeak-ng-data',speed:1,sid:0},
  language:'en',alwaysListening:true,micMode:'always',brainMode:'auto',showSpeechText:false,speakResponses:true
};
const providers=[['openai','OpenAI / GPT'],['anthropic','Anthropic / Claude'],['gemini','Google / Gemini'],['openai-compatible','OpenAI-compatible']];

export function Settings({standalone=false}:{standalone?:boolean}){
  const[open,setOpen]=useState(!standalone);
  const[s,setS]=useState<S>(defaults);
  const[has,setHas]=useState<any>({});
  const[llmKey,setLlmKey]=useState('');const[sttKey,setSttKey]=useState('');const[ttsKey,setTtsKey]=useState('');
  const[status,setStatus]=useState<any>({});

  useEffect(()=>{
    window.electronAPI.getSettings().then(x=>{
      const cfg={...defaults,...x.config};
      const micMode=(x.config?.micMode||(x.config?.alwaysListening===false?'off':'always')) as S['micMode'];
      setS({...cfg,micMode,llm:{...defaults.llm,...x.config?.llm},tts:{...defaults.tts,...x.config?.tts}});
      setHas(x.hasSecrets||{});
    });
    const removeSettings=standalone?()=>{}:window.electronAPI.onOpenSettings(()=>setOpen(true));
    return()=>{removeSettings();};
  },[standalone]);

  useEffect(()=>{
    if(!standalone)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();window.electronAPI.closeSettingsWindow();}};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[standalone]);

  async function apply(){
    const secrets:any={};
    if(llmKey.trim())secrets[s.llmProvider+':llm']=llmKey.trim();
    if(sttKey.trim()&&s.sttProvider==='openai')secrets['openai:stt']=sttKey.trim();
    if(ttsKey.trim()&&s.ttsProvider!=='local')secrets[s.ttsProvider+':tts']=ttsKey.trim();
    const next={...s,alwaysListening:s.micMode==='always'};
    await window.electronAPI.saveSettings({...next,secrets});
    await window.electronAPI.setMicMode(s.micMode);
    setS(next);setLlmKey('');setSttKey('');setTtsKey('');
    const x=await window.electronAPI.getSettings();setHas(x.hasSecrets||{});
    setStatus((v:any)=>({...v,save:'Applied'}));
  }
  async function ok(){await apply();window.electronAPI.closeSettingsWindow();}
  function cancel(){window.electronAPI.closeSettingsWindow();}

  async function clearAllKeys(){
    await window.electronAPI.clearApiKeys('all');setLlmKey('');setSttKey('');setTtsKey('');
    const x=await window.electronAPI.getSettings();setHas(x.hasSecrets||{});
    setStatus((v:any)=>({...v,keys:'All API keys have been cleared from secure storage'}));
  }
  async function disableExternal(){
    await window.electronAPI.clearApiKeys('all');
    const next={...s,brainMode:'local' as const,sttProvider:'local' as const,ttsProvider:'local' as const,micMode:s.micMode};
    setS(next);await window.electronAPI.saveSettings(next);await window.electronAPI.setMicMode(next.micMode);
    const x=await window.electronAPI.getSettings();setHas(x.hasSecrets||{});
    setStatus((v:any)=>({...v,keys:'External APIs disabled. Saeed is using local Brain, STT and TTS.'}));
  }
  async function testLLM(){const r=await window.electronAPI.testProvider({kind:'llm',provider:s.llmProvider,config:s.llm});setStatus((x:any)=>({...x,llm:r}));}
  async function testSTT(){const r=await window.electronAPI.testProvider({kind:'stt',provider:s.sttProvider,config:{model:s.sttModel}});setStatus((x:any)=>({...x,stt:r}));}
  async function testTTS(){const r=await window.electronAPI.testProvider({kind:'tts',provider:s.ttsProvider,config:s.tts});setStatus((x:any)=>({...x,tts:r}));}

  const ttsFields=s.ttsProvider==='local'
    ?<><label>Local voice model<input value={s.tts.modelFile||''} onChange={e=>setS({...s,tts:{...s.tts,modelFile:e.target.value}})}/></label><label>Local voice speed<input type="number" min="0.5" max="2" step="0.05" value={s.tts.speed||1} onChange={e=>setS({...s,tts:{...s.tts,speed:Number(e.target.value)}})}/></label><div className="status">Packaged English Sherpa-ONNX voice is used locally. No API or internet is required.</div></>
    :s.ttsProvider==='azure'
    ?<><label>Azure region<input value={s.tts.region||''} onChange={e=>setS({...s,tts:{...s.tts,region:e.target.value}})}/></label><label>Azure voice<input value={s.tts.voice||''} onChange={e=>setS({...s,tts:{...s.tts,voice:e.target.value}})}/></label><label>Azure TTS key<input type="password" placeholder={has.azure?'Saved securely':'Enter Azure Speech key'} value={ttsKey} onChange={e=>setTtsKey(e.target.value)}/></label></>
    :<><label>TTS model<input value={s.tts.model||''} onChange={e=>setS({...s,tts:{...s.tts,model:e.target.value}})}/></label><label>TTS voice<input value={s.tts.voice||''} onChange={e=>setS({...s,tts:{...s.tts,voice:e.target.value}})}/></label><label>OpenAI TTS key<input type="password" placeholder={has['openai-tts']?'Saved securely':'Enter OpenAI TTS key'} value={ttsKey} onChange={e=>setTtsKey(e.target.value)}/></label></>;

  const panel=<div className={standalone?'settingsWindow':'settingsPanel'}>
    <div className="settingsHeader"><div><h2>Saeed Settings</h2><div className="settingsSubtitle">Configure Saeed's AI, voice and interaction.</div></div>{standalone&&<button className="windowClose" onClick={cancel}>×</button>}</div>
    <h4>Brain / LLM</h4>
    <label>Brain mode<select value={s.brainMode} onChange={e=>setS({...s,brainMode:e.target.value as S['brainMode']})}><option value="auto">Auto — External LLM, then Local Brain</option><option value="local">Local brain only — no external AI</option><option value="api">External LLM only</option></select></label>
    <label>LLM provider<select value={s.llmProvider} onChange={e=>setS({...s,llmProvider:e.target.value})}>{providers.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
    <label>LLM model<input value={s.llm.model} onChange={e=>setS({...s,llm:{...s.llm,model:e.target.value}})}/></label>
    {s.llmProvider==='openai-compatible'&&<label>LLM Base URL<input placeholder="https://provider.example/v1" value={s.llm.baseUrl||''} onChange={e=>setS({...s,llm:{...s.llm,baseUrl:e.target.value}})}/></label>}
    <label>LLM API key<input type="password" placeholder={has[s.llmProvider]?'Saved securely':'Enter LLM API key'} value={llmKey} onChange={e=>setLlmKey(e.target.value)}/></label>
    <div className="settingActions"><button onClick={testLLM}>Test LLM</button></div><div className="status">LLM: {status.llm?.status||(has[s.llmProvider]?'saved':'not configured')} {status.llm?.message||''}</div>
    <hr/><h4>STT — Speech to Text</h4>
    <label>STT provider<select value={s.sttProvider} onChange={e=>setS({...s,sttProvider:e.target.value as S['sttProvider']})}><option value="local">Local Whisper — offline</option><option value="openai">OpenAI STT — API</option></select></label>
    <label>STT model<input value={s.sttModel} onChange={e=>setS({...s,sttModel:e.target.value})}/></label>
    <label>STT language<input value={s.sttLanguage} onChange={e=>setS({...s,sttLanguage:e.target.value})}/></label>
    {s.sttProvider==='openai'&&<label>OpenAI STT API key<input type="password" placeholder={has['openai-stt']?'Saved securely':'Enter OpenAI STT key'} value={sttKey} onChange={e=>setSttKey(e.target.value)}/></label>}
    <div className="settingActions"><button onClick={testSTT}>Test STT</button></div><div className="status">STT: {status.stt?.status||'not tested'} {status.stt?.message||''}</div>
    <hr/><h4>TTS — Text to Speech</h4>
    <label>TTS provider<select value={s.ttsProvider} onChange={e=>setS({...s,ttsProvider:e.target.value as S['ttsProvider']})}><option value="local">Local TTS — offline</option><option value="openai">OpenAI TTS — API</option><option value="azure">Azure Speech — API</option></select></label>
    {ttsFields}<div className="settingActions"><button onClick={testTTS}>Test TTS</button></div><div className="status">TTS: {status.tts?.status||'not tested'} {status.tts?.message||''}</div>
    <hr/><h4>Microphone & Voice</h4>
    <label>Microphone mode<select value={s.micMode} onChange={e=>setS({...s,micMode:e.target.value as S['micMode'],alwaysListening:e.target.value==='always'})}><option value="always">Always listening</option><option value="push-to-talk">Push to talk (hold Space)</option><option value="off">Close microphone</option></select></label>
    <label><input type="checkbox" checked={s.showSpeechText} onChange={e=>setS({...s,showSpeechText:e.target.checked})}/> Show what I said</label>
    <label><input type="checkbox" checked={s.speakResponses} onChange={e=>setS({...s,speakResponses:e.target.checked})}/> Speak Saeed's responses</label>
    <label>Language<input value={s.language} onChange={e=>setS({...s,language:e.target.value})}/></label>
    <hr/><h4>API & Character</h4>
    <div className="settingActions"><button onClick={clearAllKeys}>Clear all API keys</button><button onClick={disableExternal}>Disable external APIs</button></div>
    {status.keys&&<div className="status">{status.keys}</div>}
    <div className="settingActions"><button onClick={async()=>{const r=await window.electronAPI.changeAvatarModel();if(r.changed)setStatus((x:any)=>({...x,character:'Character changed'}));}}>Change Character (.vrm)</button><button onClick={async()=>{await apply();await window.electronAPI.checkForUpdates()}}>Check for updates</button></div>
    {status.character&&<div className="status">{status.character}</div>}
    {standalone&&<div className="settingsFooter"><button onClick={apply}>Apply</button><button className="primary" onClick={ok}>OK</button><button onClick={cancel}>Cancel</button><span>{status.save||''}</span></div>}
  </div>;

  if(standalone)return <div className="settingsPage">{panel}</div>;
  return <>{open&&panel}</>;
}