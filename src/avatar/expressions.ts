import type {VRM} from '@pixiv/three-vrm'; import type {Emotion} from '../types/avatar';
export function setEmotion(vrm:VRM,emotion:Emotion,weight=1){const e=vrm.expressionManager; if(!e)return; for(const n of ['happy','sad','angry','surprised','relaxed']) e.setValue(n,0); if(emotion!=='neutral') e.setValue(emotion,weight);}
export function setMouth(vrm:VRM,name:string,amount:number){vrm.expressionManager?.setValue(name,Math.max(0,Math.min(1,amount)));}
