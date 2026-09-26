import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require=createRequire(import.meta.url);
type Config=Record<string,any>;
export type ProviderStatus={provider:string,status:'connected'|'unauthorized'|'quota'|'error'|'not-configured',message:string,httpStatus?:number};

function classify(status:number,body:string):ProviderStatus['status']{
  if(status===401||status===403)return 'unauthorized';
  if(status===429||/quota|credit|billing|insufficient|exceeded|rate.?limit/i.test(body))return 'quota';
  return 'error';
}
async function read(res:Response){const t=await res.text();return t.slice(0,4000)}
function json(t:string){try{return JSON.parse(t)}catch{return null}}

export async function testLLM(provider:string,c:Config,key:string|null):Promise<ProviderStatus>{
  if(!key)return {provider,status:'not-configured',message:'API key is not configured'};
  try{
    if(provider==='openai'){
      const r=await fetch((c.baseUrl||'https://api.openai.com/v1')+'/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:c.model||'gpt-5',input:'Reply with OK only.',max_output_tokens:16})});
      const b=await read(r); return r.ok?{provider,status:'connected',message:'API connection is working'}:{provider,status:classify(r.status,b),message:b,httpStatus:r.status};
    }
    if(provider==='anthropic'){
      const r=await fetch((c.baseUrl||'https://api.anthropic.com')+'/v1/messages',{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:c.model||'claude-sonnet-4-5',max_tokens:8,messages:[{role:'user',content:'Reply with OK only.'}]})});
      const b=await read(r); return r.ok?{provider,status:'connected',message:'API connection is working'}:{provider,status:classify(r.status,b),message:b,httpStatus:r.status};
    }
    if(provider==='gemini'){
      const base=c.baseUrl||'https://generativelanguage.googleapis.com/v1beta';
      const r=await fetch(base+'/models/'+encodeURIComponent(c.model||'gemini-3.8-flash')+':generateContent',{method:'POST',headers:{'x-goog-api-key':key,'content-type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'Reply with OK only.'}]}]})});
      const b=await read(r); return r.ok?{provider,status:'connected',message:'API connection is working'}:{provider,status:classify(r.status,b),message:b,httpStatus:r.status};
    }
    const base=(c.baseUrl||'').replace(/\/$/,'');
    if(!base)return {provider,status:'error',message:'Base URL is required'};
    const r=await fetch(base+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:c.model||'model',messages:[{role:'user',content:'Reply with OK only.'}],max_tokens:16})});
    const b=await read(r); return r.ok?{provider,status:'connected',message:'OpenAI-compatible API connection is working'}:{provider,status:classify(r.status,b),message:b,httpStatus:r.status};
  }catch(e){return {provider,status:'error',message:String(e)}}
}

function messages(r:any){return [...(r.recentMessages||[]).map((m:any)=>({role:m.role==='assistant'?'assistant':'user',content:m.content})),{role:'user',content:r.userMessage}]}
function prompt(r:any){return 'You are Saeed, a helpful desktop AI companion. Be concise, direct and conversational. Do not repeat yourself. Use the available desktop-tool result when one is supplied. Language: '+(r.language||'en')+'\nMemory:\n'+JSON.stringify(r.memoryContext||[])}
async function* sse(res:Response, parser:(obj:any)=>string|undefined):AsyncIterable<string>{
  if(!res.body) return; const reader=res.body.getReader(); const dec=new TextDecoder(); let buf='';
  while(true){const {done,value}=await reader.read(); if(done)break; buf+=dec.decode(value,{stream:true}); const parts=buf.split(/\n\n/); buf=parts.pop()||''; for(const p of parts){for(const line of p.split('\n')){if(!line.startsWith('data:'))continue; const d=line.slice(5).trim(); if(!d||d==='[DONE]')continue; try{const v=parser(JSON.parse(d));if(v)yield v}catch{}}}}
}
export async function* streamLLM(provider:string,c:any,key:string,r:any):AsyncIterable<string>{
  if(provider==='openai'){
    const res=await fetch((c.baseUrl||'https://api.openai.com/v1')+'/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:c.model||'gpt-5',stream:true,input:[{role:'system',content:prompt(r)},{role:'user',content:r.userMessage}]})});
    if(!res.ok)throw new Error(await read(res)); for await(const x of sse(res,o=>o.type==='response.output_text.delta'?o.delta:undefined))yield x; return;
  }
  if(provider==='anthropic'){
    const res=await fetch((c.baseUrl||'https://api.anthropic.com')+'/v1/messages',{method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:c.model||'claude-sonnet-4-5',max_tokens:c.maxTokens||1024,stream:true,system:prompt(r),messages:messages(r)})});
    if(!res.ok)throw new Error(await read(res)); for await(const x of sse(res,o=>o.type==='content_block_delta'?o.delta?.text:undefined))yield x; return;
  }
  if(provider==='gemini'){
    const base=c.baseUrl||'https://generativelanguage.googleapis.com/v1beta';
    const res=await fetch(base+'/models/'+encodeURIComponent(c.model||'gemini-3.8-flash')+':streamGenerateContent?alt=sse',{method:'POST',headers:{'x-goog-api-key':key,'content-type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:prompt(r)}]},contents:messages(r).map((m:any)=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}))})});
    if(!res.ok)throw new Error(await read(res)); for await(const x of sse(res,o=>o.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||'').join('')))yield x; return;
  }
  const base=(c.baseUrl||'').replace(/\/$/,'');
  const res=await fetch(base+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:c.model||'model',stream:true,messages:[{role:'system',content:prompt(r)},...messages(r)]})});
  if(!res.ok)throw new Error(await read(res)); for await(const x of sse(res,o=>o.choices?.[0]?.delta?.content))yield x;
}

export async function testSTTOpenAI(key:string):Promise<ProviderStatus>{try{const r=await fetch('https://api.openai.com/v1/models',{headers:{Authorization:'Bearer '+key}});const b=await read(r);return r.ok?{provider:'openai',status:'connected',message:'OpenAI STT API key is accepted'}:{provider:'openai',status:classify(r.status,b),message:b,httpStatus:r.status};}catch(e){return{provider:'openai',status:'error',message:String(e)}}}

export async function transcribeOpenAI(audio:Buffer,key:string,model='gpt-4o-mini-transcribe',language?:string){
  const form=new FormData(); const bytes=new Uint8Array(audio); const ab=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer; form.append('file',new Blob([ab],{type:'audio/webm'}),'speech.webm'); form.append('model',model); if(language)form.append('language',language);
  const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+key},body:form});
  const t=await read(r); if(!r.ok)throw new Error(t); return json(t)?.text||'';
}

let offlineRecognizer:any=null;
let offlineRecognizerLanguage='';

export async function transcribeOffline(samples:Float32Array,sampleRate:number,modelRoot:string,language=''){
  const encoder=path.join(modelRoot,'tiny-encoder.int8.onnx');
  const decoder=path.join(modelRoot,'tiny-decoder.int8.onnx');
  const tokens=path.join(modelRoot,'tiny-tokens.txt');
  if(!fs.existsSync(encoder)||!fs.existsSync(decoder)||!fs.existsSync(tokens)){
    throw new Error('Offline speech model is not installed. Saeed cannot use local speech recognition until the offline model is packaged.');
  }
  const requestedLanguage=language==='auto'||!language?'en':language;
  if(!offlineRecognizer||offlineRecognizerLanguage!==requestedLanguage){
    const sherpa=require('sherpa-onnx-node');
    offlineRecognizer=await sherpa.OfflineRecognizer.createAsync({
      featConfig:{sampleRate:16000,featureDim:80},
      modelConfig:{whisper:{encoder,decoder,language:requestedLanguage,task:'transcribe'},tokens,numThreads:Math.max(1,Math.min(4,(require('node:os').cpus()?.length||2)-1)),provider:'cpu'},
      decodingMethod:'greedy_search'
    });
    offlineRecognizerLanguage=requestedLanguage;
  }
  const stream=offlineRecognizer.createStream();
  const pcm=samples instanceof Float32Array?samples:new Float32Array(samples);
  stream.acceptWaveform({samples:pcm,sampleRate});
  const result=await offlineRecognizer.decodeAsync(stream);
  return result?.text||offlineRecognizer.getResult(stream)?.text||'';
}

export function offlineBrain(userMessage:string){
  const t=userMessage.trim().toLocaleLowerCase();
  if(!t)return '';
  if(/^(مرحبا|اهلا|أهلا|السلام عليكم|سلام عليكم|هاي|هلا|hello|hi|hey)(\s|[!؟?,.]|$)/.test(t))return 'وعليكم السلام! أنا سعيد. أنا أعمل حتى بدون إنترنت في بعض المهام المحلية.';
  if(/(من أنت|من انت|ما اسمك|شو اسمك|what is your name|who are you)/.test(t))return 'أنا سعيد، رفيقك المكتبي ثلاثي الأبعاد. لدي الآن عقل محلي بسيط يعمل بدون API أو إنترنت لبعض الأوامر والمحادثات الأساسية.';
  if(/(كيف حالك|كيفك|شلونك|how are you)/.test(t))return 'أنا بخير وجاهز لمساعدتك.';
  if(/(شكرا|شكرًا|thanks|thank you)/.test(t))return 'العفو!';
  if(/(الوقت|كم الساعة|what time is it|time now)/.test(t))return 'الوقت الآن هو '+new Intl.DateTimeFormat('ar-JO',{hour:'numeric',minute:'2-digit'}).format(new Date())+'.';
  if(/(التاريخ|اليوم كم|ما هو اليوم|what day is it|today)/.test(t))return 'اليوم هو '+new Intl.DateTimeFormat('ar-JO',{weekday:'long',year:'numeric',month:'long',day:'numeric'}).format(new Date())+'.';
  if(/(ماذا تستطيع|شو بتقدر|ساعدني|help|what can you do)/.test(t))return 'أستطيع فهم الكلام محليًا وتحويله إلى نص، والرد على التحيات والهوية والوقت والتاريخ وبعض الأوامر الأساسية. عند توفر الإنترنت وAPI أستطيع استخدام العقل السحابي للمحادثة الأوسع.';
  return '';
}

let offlineTts:any=null;
let offlineTtsRoot='';
function wavBuffer(samples:Float32Array,sampleRate:number){
  const pcm=new Int16Array(samples.length);
  for(let i=0;i<samples.length;i++){const v=Math.max(-1,Math.min(1,samples[i]));pcm[i]=v<0?v*0x8000:v*0x7fff}
  const b=Buffer.alloc(44+pcm.byteLength);b.write('RIFF',0);b.writeUInt32LE(36+pcm.byteLength,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(sampleRate,24);b.writeUInt32LE(sampleRate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(pcm.byteLength,40);Buffer.from(pcm.buffer,pcm.byteOffset,pcm.byteLength).copy(b,44);return b;
}
export async function synthesizeOffline(text:string,modelRoot:string,c:any={}){
  const model=path.join(modelRoot,c.modelFile||'en_US-lessac-medium.onnx');
  const tokens=path.join(modelRoot,c.tokensFile||'tokens.txt');
  const dataDir=path.join(modelRoot,c.dataDir||'espeak-ng-data');
  if(!fs.existsSync(model)||!fs.statSync(model).isFile()||!fs.existsSync(tokens)||!fs.statSync(tokens).isFile()||!fs.existsSync(dataDir)||!fs.statSync(dataDir).isDirectory())throw new Error('Offline TTS model is not installed. Expected model files at: '+modelRoot);
  if(!offlineTts||offlineTtsRoot!==modelRoot){
    const sherpa=require('sherpa-onnx-node');
    offlineTts=new sherpa.OfflineTts({model:{vits:{model,tokens,dataDir},numThreads:Math.max(1,Math.min(4,(require('node:os').cpus()?.length||2)-1)),provider:'cpu'},maxNumSentences:1,silenceScale:0.2});
    offlineTtsRoot=modelRoot;
  }
  const GenerationConfig=require('sherpa-onnx-node').GenerationConfig; const gc=new GenerationConfig({sid:Number(c.sid||0),speed:Number(c.speed||1),silenceScale:Number(c.silenceScale||0.2)});
  const audio=await offlineTts.generateAsync({text,generationConfig:gc});
  return wavBuffer(audio.samples,audio.sampleRate);
}

export async function synthesizeOpenAI(text:string,key:string,c:any){
  const r=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:c.model||'gpt-4o-mini-tts',voice:c.voice||'alloy',input:text,response_format:'mp3',instructions:c.instructions})});
  if(!r.ok)throw new Error(await read(r)); return Buffer.from(await r.arrayBuffer());
}
export async function synthesizeAzure(text:string,key:string,c:any){
  const region=c.region; if(!region)throw new Error('Azure Speech region is required');
  const endpoint=c.endpoint||`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const ssml=`<speak version="1.0" xml:lang="${c.language||'en-US'}"><voice name="${c.voice||'en-US-AvaMultilingualNeural'}>${text.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'} as any)[m])}</voice></speak>`;
  const r=await fetch(endpoint,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-48kbitrate-mono-mp3'},body:ssml});
  if(!r.ok)throw new Error(await read(r)); return Buffer.from(await r.arrayBuffer());
}
export async function testTTS(provider:string,key:string|null,c:any,modelRoot?:string):Promise<ProviderStatus>{
  if(provider==='local')try{const b=await synthesizeOffline('OK',modelRoot||'',c);return b.length?{provider,status:'connected',message:'Local voice model is working'}:{provider,status:'error',message:'Empty local audio'};}catch(e){return {provider,status:'error',message:String(e)}}
  if(!key)return {provider,status:'not-configured',message:'Credential is not configured'};
  try{const audio=provider==='azure'?await synthesizeAzure('OK',key,c):await synthesizeOpenAI('OK',key,c);return audio.length?{provider,status:'connected',message:'Voice service is working'}:{provider,status:'error',message:'Empty audio response'};}
  catch(e){const m=String(e);return {provider,status:/401|403/.test(m)?'unauthorized':/429|quota|credit|billing/i.test(m)?'quota':'error',message:m};}
}
