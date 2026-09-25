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
      const r=await fetch((c.baseUrl||'https://api.openai.com/v1')+'/responses',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:c.model||'gpt-5',input:'Reply with OK only.',max_output_tokens:4})});
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
    const r=await fetch(base+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:c.model||'model',messages:[{role:'user',content:'Reply with OK only.'}],max_tokens:4})});
    const b=await read(r); return r.ok?{provider,status:'connected',message:'OpenAI-compatible API connection is working'}:{provider,status:classify(r.status,b),message:b,httpStatus:r.status};
  }catch(e){return {provider,status:'error',message:String(e)}}
}

function messages(r:any){return [...(r.recentMessages||[]).map((m:any)=>({role:m.role==='assistant'?'assistant':'user',content:m.content})),{role:'user',content:r.userMessage}]}
function prompt(r:any){return 'You are Saeed, a helpful desktop AI companion. Be concise and conversational. Language: '+(r.language||'en')+'\nMemory:\n'+JSON.stringify(r.memoryContext||[])+'\nUser: '+r.userMessage}
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

export async function transcribeOpenAI(audio:Buffer,key:string,model='gpt-4o-mini-transcribe',language?:string){
  const form=new FormData(); const bytes=new Uint8Array(audio); const ab=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer; form.append('file',new Blob([ab],{type:'audio/webm'}),'speech.webm'); form.append('model',model); if(language)form.append('language',language);
  const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+key},body:form});
  const t=await read(r); if(!r.ok)throw new Error(t); return json(t)?.text||'';
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
export async function testTTS(provider:string,key:string|null,c:any):Promise<ProviderStatus>{
  if(!key)return {provider,status:'not-configured',message:'Credential is not configured'};
  try{const audio=provider==='azure'?await synthesizeAzure('OK',key,c):await synthesizeOpenAI('OK',key,c); return audio.length?{provider,status:'connected',message:'Voice service is working'}:{provider,status:'error',message:'Empty audio response'};}
  catch(e){const m=String(e);return {provider,status:/401|403/.test(m)?'unauthorized':/429|quota|credit|billing/i.test(m)?'quota':'error',message:m};}
}