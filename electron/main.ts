import {app,BrowserWindow,ipcMain,shell} from 'electron';
import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {createCompanionWindow} from './windows/companionWindow.js';
import {Database} from './services/database.js'; import {Credentials} from './services/credentials.js';
import {testLLM,streamLLM,transcribeOpenAI,synthesizeOpenAI,synthesizeAzure,testTTS} from './services/providers.js';
import {setupUpdater,check as checkUpdates,install as installUpdate,current as updateState} from './services/updater.js';
const __dirname=path.dirname(fileURLToPath(import.meta.url)); let win:BrowserWindow|null=null; let db:Database|null=null; let creds:Credentials|null=null;
function keyFor(p:string){return p==='azure'?'azureSpeechKey':p==='openai'?'openaiApiKey':p==='anthropic'?'anthropicApiKey':p==='gemini'?'geminiApiKey':p==='openai-compatible'?'compatibleApiKey':'openaiApiKey'}
app.whenReady().then(()=>{
  db=new Database(path.join(app.getPath('userData'),'memory.sqlite3')); creds=new Credentials(db);
  app.setAppUserModelId('com.saeed.desktop'); win=createCompanionWindow(__dirname); setupUpdater(win);
  ipcMain.handle('settings:get',()=>({config:db!.getSetting('settings')??{},hasSecrets:Object.fromEntries(['openai','anthropic','gemini','openai-compatible','azure'].map(p=>[p,Boolean(creds!.get(keyFor(p)))]))}));
  ipcMain.handle('settings:save',(_,v:any)=>{const {secrets,...safe}=v||{}; db!.setSetting('settings',safe); for(const [k,val] of Object.entries(secrets||{})){if(typeof val==='string'&&val.trim())creds!.set(keyFor(k),val)} return true});
  ipcMain.handle('provider:test',async(_,v:any)=>{const p=v.provider; const k=creds!.get(keyFor(p)); return p==='azure'||p==='openai-tts'?await testTTS(p==='openai-tts'?'openai':'azure',k,v.config||{}):await testLLM(p,v.config||{},k)});
  ipcMain.handle('chat:send',async(e,req:any)=>{const cfg=db!.getSetting('settings')||{};const p=cfg.llmProvider||'openai';const key=creds!.get(keyFor(p));if(!key)throw new Error('No API key configured for '+p);let full='';for await(const d of streamLLM(p,cfg.llm||{},key,req)){full+=d;e.sender.send('chat:delta',d)};e.sender.send('chat:done',full); return full});
  ipcMain.handle('audio:transcribe',async(_,b:any)=>{const key=creds!.get('openaiApiKey');if(!key)throw new Error('OpenAI STT key is not configured');return transcribeOpenAI(Buffer.from(b),key,(db!.getSetting('settings')||{}).sttModel||'gpt-4o-mini-transcribe',(db!.getSetting('settings')||{}).language||undefined)});
  ipcMain.handle('audio:speak',async(_,text:string)=>{const cfg=db!.getSetting('settings')||{};const p=cfg.ttsProvider||'openai';const key=creds!.get(keyFor(p==='azure'?'azure':'openai'));if(!key)throw new Error('TTS credential is not configured');return (p==='azure'?synthesizeAzure(text,key,cfg.tts||{}):synthesizeOpenAI(text,key,cfg.tts||{})).then(b=>b.toString('base64'))});
  ipcMain.handle('update:check',()=>checkUpdates()); ipcMain.handle('update:install',()=>installUpdate()); ipcMain.handle('update:state',()=>updateState());
  ipcMain.handle('system:toggle-clickthrough',(_,v)=>{win?.setIgnoreMouseEvents(Boolean(v),{forward:true});return true});
  ipcMain.handle('system:open',async(_,target:string)=>{const t=String(target||'').trim(); if(/^my computer$/i.test(t)||/^this pc$/i.test(t))return shell.openPath('C:\\'); if(/^[a-zA-Z]:[\\/]/.test(t))return shell.openPath(t); return shell.openPath(path.join(app.getPath('home'),t.replace(/^~[\\/]?/,'')))});
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)win=createCompanionWindow(__dirname)});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});