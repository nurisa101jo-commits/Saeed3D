declare global {
  interface Window {
    electronAPI: {
      loadAvatarModel(): Promise<Uint8Array>;
      changeAvatarModel(): Promise<{changed:boolean}>;
      getSettings(): Promise<any>;
      saveSettings(v:any): Promise<any>;
      testProvider(v:any): Promise<any>;
      sendChat(v:any): Promise<any>;
      transcribe(v:{webm:ArrayBuffer;samples:Float32Array;sampleRate:number}): Promise<string>;
      speak(t:string): Promise<string>;
      checkForUpdates(): Promise<any>;
      installUpdate(): Promise<any>;
      getUpdateState(): Promise<any>;
      setClickThrough(v:boolean): Promise<any>;
      openPath(p:string): Promise<any>;
      setBrainMode(v:'auto'|'local'|'api'): Promise<string>;
      setMicMode(v:'always'|'push-to-talk'|'off'): Promise<string>;
      clearApiKeys(scope?:'all'|'llm'|'stt'|'tts'): Promise<boolean>;
      moveWindowBy(dx:number,dy:number): Promise<boolean>;
      closeSettingsWindow(): Promise<boolean>;
      onChatDelta(cb:(s:string)=>void): ()=>void;
      onUpdate(cb:(s:any)=>void): ()=>void;
      onOpenSettings(cb:()=>void): ()=>void;
      onOpenChat(cb:()=>void): ()=>void;
      onMicMode(cb:(s:'always'|'push-to-talk'|'off')=>void): ()=>void;
      onChangeCharacter(cb:()=>void): ()=>void;
      onAvatarChanged(cb:()=>void): ()=>void;
    };
  }
}
export {};