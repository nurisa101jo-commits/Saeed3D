import {app,BrowserWindow,dialog,ipcMain,shell} from 'electron';
import path from 'node:path'; import fs from 'node:fs'; import {fileURLToPath} from 'node:url';
import {createCompanionWindow,revealCompanionWindow} from './windows/companionWindow.js';
import {Database} from './services/database.js'; import {Credentials} from './services/credentials.js';
import {testLLM,streamLLM,transcribeOpenAI,transcribeOffline,offlineBrain,synthesizeOpenAI,synthesizeAzure,testTTS} from './services/providers.js';
import {setupUpdater,check as checkUpdates,install as installUpdate,current as updateState} from './services/updater.js';
function keyFor(provider:string){const map:Record<string,string>={openai:'openaiApiKey',anthropic:'anthropicApiKey',gemini:'geminiApiKey','openai-compatible':'openaiCompatibleApiKey',azure:'azureApiKey','openai-tts':'openaiApiKey'};return map[provider]??(provider+'ApiKey');}
const __dirname=path.dirname(fileURLToPath(import.meta.url)); let win:BrowserWindow|null=null; let db:Database|null=null; let creds:Credentials|null=null;

const gotTheLock=app.requestSingleInstanceLock();
if(!gotTheLock){
  app.quit();
}else{
  app.on('second-instance',()=>{
    if(win&&!win.isDestroyed())revealCompanionWindow(win);
  });

  app.whenReady().then(()=>{
    db=new Database(path.join(app.getPath('userData'),'memory.sqlite3')); creds=new Credentials(db);
    app.setAppUserModelId('com.saeed.desktop'); win=createCompanionWindow(__dirname); setupUpdater(win);
    ipcMain.handle('avatar:load-model',()=>{const custom=path.join(app.getPath('userData'),'character.vrm');const candidates=[custom,path.join(process.resourcesPath,'models','saeed.vrm'),path.join(app.getAppPath(),'dist','models','saeed.vrm'),path.join(__dirname,'../dist/models/saeed.vrm')];for(const p of candidates){if(fs.existsSync(p))return fs.readFileSync(p)}throw new Error('Saeed VRM asset not found');});
    ipcMain.handle('avatar:choose-model',async()=>{
      const result=await dialog.showOpenDialog(win ?? BrowserWindow.getAllWindows()[0],{
        title:'Choose Saeed Character',
        properties:['openFile'],
        filters:[{name:'VRM Character',extensions:['vrm']}]
      });
      if(result.canceled||!result.filePaths[0])return {changed:false};
      const source=result.filePaths[0];
      const destination=path.join(app.getPath('userData'),'character.vrm');
      fs.copyFileSync(source,destination);
      if(win&&!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('avatar:model-changed');
      return {changed:true};
    });
    ipcMain.handle('settings:get',()=>({config:db!.getSetting('settings')??{},hasSecrets:Object.fromEntries(['openai','anthropic','gemini','openai-compatible','azure'].map(p=>[p,Boolean(creds!.get(keyFor(p)))]))}));
    ipcMain.handle('settings:save',(_,v:any)=>{const {secrets,...safe}=v||{}; db!.setSetting('settings',safe); for(const [k,val] of Object.entries(secrets||{})){if(typeof val==='string'&&val.trim())creds!.set(keyFor(k),val)} return true});
    ipcMain.handle('provider:test',async(_,v:any)=>{const p=v.provider; const k=creds!.get(keyFor(p)); return p==='azure'||p==='openai-tts'?await testTTS(p==='openai-tts'?'openai':'azure',k,v.config||{}):await testLLM(p,v.config||{},k)});
    ipcMain.handle('chat:send',async(e,req:any)=>{
      const cfg=db!.getSetting('settings')||{};
      const p=cfg.llmProvider||'openai';
      const key=creds!.get(keyFor(p));
      if(!key){
        const local=offlineBrain(String(req?.userMessage||''));
        if(local){e.sender.send('chat:delta',local);e.sender.send('chat:done',local);return local;}
        throw new Error('No API key configured and the local brain does not know this request yet.');
      }
      let full='';for await(const d of streamLLM(p,cfg.llm||{},key,req)){full+=d;e.sender.send('chat:delta',d)};e.sender.send('chat:done',full); return full;
    });
    ipcMain.handle('audio:transcribe',async(_,input:any)=>{
      const cfg=db!.getSetting('settings')||{};
      const key=creds!.get('openaiApiKey');
      if(key&&input?.webm)return transcribeOpenAI(Buffer.from(input.webm),key,cfg.sttModel||'gpt-4o-mini-transcribe',cfg.language||undefined);
      if(!input?.samples)throw new Error('No decoded microphone audio was received.');
      const language=cfg.sttLanguage||'auto';
      const candidates=[
        path.join(process.resourcesPath,'models','offline-stt','sherpa-onnx-whisper-tiny'),
        path.join(app.getAppPath(),'dist','models','offline-stt','sherpa-onnx-whisper-tiny'),
        path.join(app.getAppPath(),'public','models','offline-stt','sherpa-onnx-whisper-tiny'),
        path.join(__dirname,'../dist/models/offline-stt/sherpa-onnx-whisper-tiny')
      ];
      const modelRoot=candidates.find(p=>fs.existsSync(path.join(p,'tiny-encoder.int8.onnx')))??candidates[0];
      return transcribeOffline(input.samples instanceof Float32Array?input.samples:new Float32Array(input.samples),Number(input.sampleRate)||16000,modelRoot,language);
    });
    ipcMain.handle('audio:speak',async(_,text:string)=>{const cfg=db!.getSetting('settings')||{};const p=cfg.ttsProvider||'openai';const key=creds!.get(keyFor(p==='azure'?'azure':'openai'));if(!key)throw new Error('TTS credential is not configured');return (p==='azure'?synthesizeAzure(text,key,cfg.tts||{}):synthesizeOpenAI(text,key,cfg.tts||{})).then(b=>b.toString('base64'))});
    ipcMain.handle('update:check',()=>checkUpdates()); ipcMain.handle('update:install',()=>installUpdate()); ipcMain.handle('update:state',()=>updateState());
    ipcMain.handle('system:toggle-clickthrough',(_,v)=>{win?.setIgnoreMouseEvents(Boolean(v),{forward:true});return true});
    ipcMain.handle('system:open',async(_,target:string)=>{const t=String(target||'').trim(); if(/^my computer$/i.test(t)||/^this pc$/i.test(t))return shell.openPath('C:\\'); if(/^[a-zA-Z]:[\\/]/.test(t))return shell.openPath(t); return shell.openPath(path.join(app.getPath('home'),t.replace(/^~[\\/]?/,'')))});
    app.on('activate',()=>{if(!win||win.isDestroyed())win=createCompanionWindow(__dirname);else revealCompanionWindow(win)});
  });
}
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});