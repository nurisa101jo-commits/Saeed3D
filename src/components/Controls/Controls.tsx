import {useEffect,useState} from 'react';
export function Controls(){
 const[through,setThrough]=useState(false);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.ctrlKey&&e.shiftKey&&e.code==='KeyI'){e.preventDefault();setThrough(v=>{const n=!v;void window.electronAPI.setClickThrough(n);return n})}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
 const toggle=()=>setThrough(v=>{const n=!v;void window.electronAPI.setClickThrough(n);return n});
 return <div className="controls"><button onClick={toggle} title="Click-through: lets clicks reach the app behind Saeed. Ctrl+Shift+I toggles it back.">{through?'Enable interaction':'Click-through'}</button></div>
}