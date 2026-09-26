import React,{useEffect,useState} from 'react';import{createRoot}from'react-dom/client';import App from './App';

function GlobalErrorOverlay(){
 const[error,setError]=useState('');
 useEffect(()=>{
  const onError=(event:ErrorEvent)=>setError(event.message||String(event.error||'Unknown renderer error'));
  const onReject=(event:PromiseRejectionEvent)=>setError(String(event.reason||'Unhandled promise rejection'));
  window.addEventListener('error',onError);
  window.addEventListener('unhandledrejection',onReject);
  return()=>{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onReject)};
 },[]);
 if(!error)return null;
 return <div style={{position:'fixed',inset:0,zIndex:99999,padding:18,fontFamily:'system-ui',color:'#fff',background:'#111318',boxSizing:'border-box',overflow:'auto'}}><h3>Saeed error</h3><div style={{fontSize:12,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{error}</div><button style={{marginTop:14}} onClick={()=>setError('')}>Dismiss</button></div>;
}

class AppErrorBoundary extends React.Component<{children:React.ReactNode},{error:string}>{
 state={error:''};
 static getDerivedStateFromError(error:unknown){return {error:String(error)}}
 componentDidCatch(error:unknown,info:React.ErrorInfo){console.error('[Saeed] React renderer error:',error,info)}
 render(){if(this.state.error)return <div style={{padding:18,fontFamily:'system-ui',color:'#fff',background:'#111318',height:'100%',boxSizing:'border-box'}}><h3>Saeed renderer error</h3><div style={{fontSize:12,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{this.state.error}</div></div>;return this.props.children}
}

function Root(){return <><AppErrorBoundary><App/></AppErrorBoundary><GlobalErrorOverlay/></>}

createRoot(document.getElementById('root')!).render(<React.StrictMode><Root/></React.StrictMode>);
