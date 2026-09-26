import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const WebSocket=require('ws');

type RealtimeCallbacks={
  state?:(state:'connecting'|'connected'|'disconnected'|'error',message?:string)=>void;
  event?:(event:any)=>void;
};

export class OpenAIRealtime{
  private ws:any=null;
  private key='';
  private callbacks:RealtimeCallbacks={};
  private stopped=false;
  private retryTimer:NodeJS.Timeout|undefined;
  private retryMs=3000;
  private model='gpt-realtime-2.1';
  private instructions='You are Saeed, a helpful desktop AI companion. Speak naturally, briefly and directly. Do not repeat yourself. Maintain conversational context. If interrupted, stop speaking immediately and listen to the user.';

  constructor(callbacks:RealtimeCallbacks={}){this.callbacks=callbacks}
  start(key:string,options:any={}){this.key=key;this.model=options.model||'gpt-realtime-2.1';this.instructions=options.instructions||this.instructions;this.stopped=false;this.clearRetry();this.connect()}
  stop(){this.stopped=true;this.clearRetry();const s=this.ws;this.ws=null;try{s?.close()}catch{}this.callbacks.state?.('disconnected')}
  appendAudio(base64:string){if(this.ws?.readyState===1)this.send({type:'input_audio_buffer.append',audio:base64})}
  commit(){if(this.ws?.readyState===1)this.send({type:'input_audio_buffer.commit'})}
  clear(){if(this.ws?.readyState===1)this.send({type:'input_audio_buffer.clear'})}
  cancel(){if(this.ws?.readyState===1)this.send({type:'response.cancel'})}
  text(text:string){if(this.ws?.readyState!==1)return;this.send({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}});this.send({type:'response.create'})}
  seed(history:any[]){if(this.ws?.readyState!==1)return;for(const m of history.slice(-20)){if(!m?.content)continue;this.send({type:'conversation.item.create',item:{type:'message',role:m.role==='assistant'?'assistant':'user',content:[{type:m.role==='assistant'?'output_text':'input_text',text:String(m.content).slice(0,12000)}]}})}}
  private connect(){if(this.stopped||!this.key)return;this.callbacks.state?.('connecting');let socket:any;try{socket=new WebSocket('wss://api.openai.com/v1/realtime?model='+encodeURIComponent(this.model),{headers:{Authorization:'Bearer '+this.key}})}catch(e){this.fail(String(e));return}this.ws=socket;socket.on('open',()=>{if(this.ws!==socket)return;this.retryMs=3000;this.send({type:'session.update',session:{type:'realtime',model:this.model,output_modalities:['audio'],audio:{input:{format:{type:'audio/pcm',rate:24000},transcription:{model:'gpt-transcribe',language:'auto',delay:'low'},turn_detection:{type:'semantic_vad',interrupt_response:true,create_response:true}},output:{format:{type:'audio/pcm',rate:24000},voice:'marin'}},instructions:this.instructions}});this.callbacks.state?.('connected')});socket.on('message',(raw:any)=>{try{this.callbacks.event?.(JSON.parse(raw.toString()))}catch{}});socket.on('error',(e:any)=>this.fail(String(e?.message||e)));socket.on('close',()=>{if(this.ws===socket)this.ws=null;if(!this.stopped){this.callbacks.state?.('disconnected','Realtime connection closed');this.scheduleRetry()}})}
  private send(value:any){try{if(this.ws?.readyState===1)this.ws.send(JSON.stringify(value))}catch(e){this.fail(String(e))}}
  private fail(message:string){this.callbacks.state?.('error',message);if(!this.stopped)this.scheduleRetry()}
  private scheduleRetry(){if(this.retryTimer||this.stopped)return;const delay=this.retryMs;this.retryMs=Math.min(15000,this.retryMs*2);this.retryTimer=setTimeout(()=>{this.retryTimer=undefined;this.connect()},delay)}
  private clearRetry(){if(this.retryTimer)clearTimeout(this.retryTimer);this.retryTimer=undefined}
}
