import {BrowserWindow,screen} from 'electron';
import path from 'node:path';

let settingsWindow:BrowserWindow|null=null;

export function openSettingsWindow(root:string,parent?:BrowserWindow|null){
  if(settingsWindow&&!settingsWindow.isDestroyed()){
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }
  const d=screen.getPrimaryDisplay();
  settingsWindow=new BrowserWindow({
    width:760,height:820,
    minWidth:620,minHeight:600,
    x:Math.max(d.workArea.x+20,d.workArea.x+Math.round((d.workArea.width-760)/2)),
    y:Math.max(d.workArea.y+20,d.workArea.y+Math.round((d.workArea.height-820)/2)),
    title:'Saeed Settings',
    backgroundColor:'#111318',
    show:false,
    autoHideMenuBar:true,
    parent:parent??undefined,
    webPreferences:{preload:path.join(root,'preload.mjs'),nodeIntegration:false,contextIsolation:true,sandbox:false}
  });
  settingsWindow.on('closed',()=>{settingsWindow=null});
  const indexPath=path.join(root,'../dist/index.html');
  const load=process.env.VITE_DEV_SERVER_URL
    ?settingsWindow.loadURL(process.env.VITE_DEV_SERVER_URL+'?settings=1')
    :settingsWindow.loadFile(indexPath,{search:'?settings=1'});
  load.then(()=>settingsWindow?.show()).catch(e=>console.error('[Saeed] settings window load error:',e));
  return settingsWindow;
}

export function closeSettingsWindow(){if(settingsWindow&&!settingsWindow.isDestroyed())settingsWindow.close();}
export function getSettingsWindow(){return settingsWindow;}
