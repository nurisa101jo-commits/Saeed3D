import type {ChatRequest,LLMEvent} from '../types/api';
export class ConversationManager{async run(r:ChatRequest,onDelta:(s:string)=>void){let full='';const off=window.electronAPI.onChatDelta(d=>{full+=d;onDelta(d)});try{await window.electronAPI.sendChat(r);return full}finally{off()}}}
export async function runCommand(text:string){const m=text.match(/^(?:please\s+)?open\s+(.+)$/i);if(!m)return false;await window.electronAPI.openPath(m[1].trim());return true}
export type {LLMEvent};