import {app,BrowserWindow,Menu,Notification,Tray,nativeImage,dialog} from 'electron';
import electronUpdater from 'electron-updater';
import {revealCompanionWindow} from '../windows/companionWindow.js';
import {openSettingsWindow} from '../windows/settingsWindow.js';
const {autoUpdater}=electronUpdater;
import path from 'node:path'; import fs from 'node:fs'; import {fileURLToPath} from 'node:url';

type U={state:string;version?:string;percent?:number;transferred?:number;total?:number;message?:string};
let tray:Tray|undefined;let win:BrowserWindow|undefined;let state:U={state:'idle'};
const root=path.dirname(fileURLToPath(import.meta.url));

function emit(){if(win&&!win.isDestroyed()&&win.webContents&&!win.webContents.isDestroyed())win.webContents.send('update:status',state)}
function set(s:U){state=s;emit();tray?.setToolTip('Saeed — '+(s.message||s.state))}
function reveal(){if(win&&!win.isDestroyed())revealCompanionWindow(win)}
function openSettings(){reveal();if(win&&!win.isDestroyed())openSettingsWindow(root,win)}
async function changeCharacter(){
  reveal();
  const result=await dialog.showOpenDialog(win&&!win.isDestroyed()?win:BrowserWindow.getAllWindows()[0],{title:'Choose Saeed Character',properties:['openFile'],filters:[{name:'VRM Character',extensions:['vrm']}]});
  if(result.canceled||!result.filePaths[0])return;
  const destination=path.join(app.getPath('userData'),'character.vrm');
  fs.copyFileSync(result.filePaths[0],destination);
  if(win&&!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('avatar:model-changed');
}

export function setupUpdater(w:BrowserWindow){
  win=w;
  app.setAppUserModelId('com.saeed.desktop');
  const iconPath=app.isPackaged?path.join(process.resourcesPath,'icons','saeed.ico'):path.join(root,'../../public/icons/saeed.ico');
  const icon=nativeImage.createFromPath(iconPath);
  tray=new Tray(icon);
  tray.setToolTip('Saeed');
  const refreshTray=()=>{
    const visible=Boolean(win&&!win.isDestroyed()&&win.isVisible());
    tray?.setContextMenu(Menu.buildFromTemplate([
      {label:visible?'Hide Saeed':'Show Saeed',click:()=>{if(!win||win.isDestroyed())return;if(win.isVisible())win.hide();else reveal();refreshTray()}},
      {label:'Start chat',click:()=>{reveal();win?.webContents.send('ui:open-chat')}},
      {label:'Settings',click:()=>openSettings()},
      {label:'Microphone',submenu:[
        {label:'Always listening',click:()=>win?.webContents.send('tray:mic-mode','always')},
        {label:'Push to talk (hold Space)',click:()=>win?.webContents.send('settings:mic-mode','push-to-talk')},
        {label:'Close microphone',click:()=>win?.webContents.send('settings:mic-mode','off')}
      ]},
      {type:'separator'},
      {label:'Change Character',click:()=>{void changeCharacter()}},
      {label:'Check for updates',click:()=>{reveal();void check()}},
      {type:'separator'},
      {label:'Quit Saeed',click:()=>app.quit()}
    ]));
  };
  refreshTray();
  win?.on('show',refreshTray);win?.on('hide',refreshTray);

  autoUpdater.allowPrerelease=false;
autoUpdater.autoDownload=true;
  autoUpdater.autoInstallOnAppQuit=true;
  autoUpdater.on('checking-for-update',()=>set({state:'checking',message:'Checking for updates…'}));
  autoUpdater.on('update-available',i=>{
    reveal();
    set({state:'available',version:i.version,message:'Update available: '+i.version});
    tray?.displayBalloon({title:'Saeed update available',content:'Version '+i.version+' is being downloaded.'});
    new Notification({title:'Saeed update available',body:'Version '+i.version+' is being downloaded.'}).show();
  });
  autoUpdater.on('download-progress',p=>set({state:'downloading',version:state.version,percent:p.percent,transferred:p.transferred,total:p.total,message:`Downloading ${p.percent.toFixed(0)}% — ${(p.transferred/1048576).toFixed(1)} / ${(p.total/1048576).toFixed(1)} MB`}));
  autoUpdater.on('update-downloaded',i=>{
    reveal();
    set({state:'downloaded',version:i.version,percent:100,message:'Update downloaded and ready to install'});
    tray?.displayBalloon({title:'Saeed update ready',content:'The update is ready to install.'});
    new Notification({title:'Saeed update ready',body:'The update is ready to install.'}).show();
  });
  autoUpdater.on('update-not-available',()=>set({state:'current',message:'Saeed is up to date'}));
  autoUpdater.on('error',e=>{reveal();set({state:'error',message:e.message});setTimeout(()=>{if(state.state==='error')set({state:'idle',message:''})},5000)});
  setTimeout(()=>{if(app.isPackaged)void check()},8000);
}

export async function check(){
  reveal();
  set({state:'checking',message:'Checking for updates…'});
  try{await autoUpdater.checkForUpdates()}
  catch(e){reveal();set({state:'error',message:String(e)});setTimeout(()=>{if(state.state==='error')set({state:'idle',message:''})},5000)}
}
export function install(){if(state.state==='downloaded')autoUpdater.quitAndInstall()}
export function current(){return state}
