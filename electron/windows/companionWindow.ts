import {BrowserWindow,screen} from 'electron';
import path from 'node:path';

function visibleBounds(win:BrowserWindow){
  const bounds=win.getBounds();
  const displays=screen.getAllDisplays();
  const visible=displays.some(d=>{
    const r=d.workArea;
    return bounds.x+bounds.width>r.x&&bounds.x<r.x+r.width&&bounds.y+bounds.height>r.y&&bounds.y<r.y+r.height;
  });
  if(!visible){
    const d=screen.getPrimaryDisplay();
    const w=Math.min(360,Math.max(300,Math.floor(d.workArea.width*.24)));
    const h=Math.min(520,Math.max(400,Math.floor(d.workArea.height*.58)));
    win.setBounds({
      x:d.workArea.x+d.workArea.width-w-24,
      y:d.workArea.y+d.workArea.height-h-24,
      width:w,
      height:h
    });
  }
}

export function revealCompanionWindow(win:BrowserWindow){
  if(win.isDestroyed())return;
  visibleBounds(win);
  if(win.isMinimized())win.restore();
  win.setOpacity(1);
  win.setAlwaysOnTop(true,'floating');
  win.show();
  win.focus();
  win.moveTop();
}

export function createCompanionWindow(root:string){
  const d=screen.getPrimaryDisplay();
  const w=Math.min(360,Math.max(300,Math.floor(d.workArea.width*.24)));
  const h=Math.min(520,Math.max(400,Math.floor(d.workArea.height*.58)));
  const win=new BrowserWindow({
    width:w,height:h,minWidth:280,minHeight:360,
    x:d.workArea.x+d.workArea.width-w-24,
    y:d.workArea.y+d.workArea.height-h-24,
    frame:false,
    transparent:false,
    backgroundColor:'#111318',
    resizable:false,
    maximizable:false,
    minimizable:true,
    hasShadow:true,
    alwaysOnTop:true,
    skipTaskbar:false,
    show:true,
    paintWhenInitiallyHidden:true,
    webPreferences:{
      preload:path.join(root,'preload.js'),
      nodeIntegration:false,
      contextIsolation:true,
      sandbox:false,
      backgroundThrottling:false
    }
  });

  win.setOpacity(1);
  win.setAlwaysOnTop(true,'floating');

  const reveal=()=>revealCompanionWindow(win);
  win.on('show',()=>console.log('[Saeed] companion window shown',win.getBounds()));
  win.on('hide',()=>console.log('[Saeed] companion window hidden'));
  win.on('closed',()=>console.log('[Saeed] companion window closed'));
  win.on('unresponsive',()=>console.error('[Saeed] renderer became unresponsive'));
  win.webContents.on('render-process-gone',(_e,details)=>{
    console.error('[Saeed] renderer process gone:',details.reason,details.exitCode);
    if(!win.isDestroyed())setTimeout(reveal,100);
  });
  win.webContents.on('did-finish-load',()=>{
    console.log('[Saeed] renderer finished loading');
    reveal();
  });
  win.webContents.on('did-fail-load',(_e,code,desc,url)=>{
    console.error('[Saeed] renderer failed to load:',code,desc,url);
    reveal();
  });
  win.webContents.on('console-message',(_e,_level,message,line,source)=>{
    console.log('[Saeed renderer]',message,source,line);
  });

  const indexPath=path.join(root,'../dist/index.html');
  const load=process.env.VITE_DEV_SERVER_URL
    ?win.loadURL(process.env.VITE_DEV_SERVER_URL)
    :win.loadFile(indexPath);
  load.catch(e=>console.error('[Saeed] window load error:',e));

  return win;
}
