import {useEffect,useState} from 'react';

function getErrorMessage(error:unknown){
  if(error instanceof Error)return error.stack||error.message;
  return String(error);
}

export function UpdateStatus(){
  const[s,setS]=useState<any>({state:'idle'});
  const[error,setError]=useState('');
  useEffect(()=>{
    try{
      const api=window.electronAPI;
      if(!api?.getUpdateState||!api?.onUpdate){
        setError('Electron preload API is unavailable. The application could not load preload.mjs.');
        return;
      }
      api.getUpdateState().then(setS).catch((e)=>setError(getErrorMessage(e)));
      return api.onUpdate(setS);
    }catch(e){
      setError(getErrorMessage(e));
    }
  },[]);
  if(error)return <div className="updateStatus"><b>Saeed error</b><span>{error}</span></div>;
  if(['idle','current'].includes(s.state))return null;
  return <div className="updateStatus"><b>{s.state==='checking'?'Checking…':s.state==='available'?'Update available':s.state==='downloading'?'Updating…':s.state==='downloaded'?'Update ready':s.state==='error'?'Update error':s.state}</b>{s.total?<span>{s.percent?.toFixed(0)}% · {(s.transferred/1048576).toFixed(1)} / {(s.total/1048576).toFixed(1)} MB</span>:s.message&&<span>{s.message}</span>}{s.state==='downloaded'&&<button onClick={()=>window.electronAPI.installUpdate()}>Restart & install</button>}</div>
}
