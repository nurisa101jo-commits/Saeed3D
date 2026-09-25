import type {VRM} from '@pixiv/three-vrm'; export function updateLookAt(vrm:VRM,x:number,y:number){vrm.lookAt?.lookAt({x,y,z:1} as any);}
