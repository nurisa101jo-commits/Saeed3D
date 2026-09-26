import {BrowserWindow,screen} from 'electron';
import path from 'node:path';

export function createCompanionWindow(root:string){
  const d=screen.getPrimaryDisplay();
  const w=Math.min(360,Math.max(300,Math.floor(d.workArea.width*.24)));
  const h=Math.min(520,Math.max(400,Math.floor(d.workArea.height*.58)));
  const win=new BrowserWindow({
    width:w,height:h,minWidth:280,minHeight:360,
    x:d.workArea.x+d.workArea.width-w-24,
    y:d.workArea.y+d.workArea.height-h-24,
    frame:false,
    transparent:true,
    backgroundColor:'#00000000',
    resizable:true,
    hasShadow:true,
    alwaysOnTop:true,
    skipTaskbar:false,
    show:false,
    webPreferences:{
      preload:path.join(root,'preload.js'),
      nodeIntegration:false,
      contextIsolation:true,
      sandbox:true
    }
  });

  win.once('ready-to-show',()=>win.show());
  win.webContents.on('did-fail-load',(_e,code,desc,url)=>{
    console.error('[Saeed] renderer failed to load:',code,desc,url);
    win.show();
  });
  win.webContents.on('console-message',(_e,level,message,line,source)=>{
    console.log('[Saeed renderer]',message,source,line);
  });

  const indexPath=path.join(root,'../dist/index.html');
  if(process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(indexPath);

  return win;
}