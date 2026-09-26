import React from 'react';import{createRoot}from'react-dom/client';import App from './App';

class AppErrorBoundary extends React.Component<{children:React.ReactNode},{error:string}>{
 state={error:''};
 static getDerivedStateFromError(error:unknown){return {error:String(error)}}
 componentDidCatch(error:unknown,info:React.ErrorInfo){console.error('[Saeed] React renderer error:',error,info)}
 render(){if(this.state.error)return <div style={{padding:18,fontFamily:'system-ui',color:'#fff',background:'#111318',height:'100%',boxSizing:'border-box'}}><h3>Saeed renderer error</h3><div style={{fontSize:12,whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{this.state.error}</div></div>;return this.props.children}
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><AppErrorBoundary><App/></AppErrorBoundary></React.StrictMode>);
