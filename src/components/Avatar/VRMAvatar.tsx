import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRM} from '@pixiv/three-vrm';
import {setEmotion} from '../../avatar/expressions';

export function VRMAvatar(){
  const ref=useRef<HTMLDivElement>(null);
  const [status,setStatus]=useState('Loading Saeed 3D…');

  useEffect(()=>{
    const host=ref.current;
    if(!host)return;

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(24,1,0.01,100);
    let renderer:THREE.WebGLRenderer;
    try{
      renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
    }catch(e){
      console.error('[Saeed] WebGL renderer initialization failed:',e);
      setStatus('3D unavailable: Windows/WebGL could not initialize.');
      return;
    }
    try{renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));}catch(e){console.warn('[Saeed] renderer setup failed:',e);setStatus('3D unavailable: renderer setup failed.');renderer.dispose();return;}
    renderer.setClearColor(0x000000,0);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.setSize(Math.max(1,host.clientWidth),Math.max(1,host.clientHeight));
    renderer.domElement.style.display='block';
    renderer.domElement.style.width='100%';
    renderer.domElement.style.height='100%';
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff,0x444444,1.8));
    const key=new THREE.DirectionalLight(0xffffff,1.5);
    key.position.set(1,2,3);
    scene.add(key);

    const loader=new GLTFLoader();
    loader.register(p=>new VRMLoaderPlugin(p));
    let vrm:VRM|undefined;
    let cancelled=false;
    let loadSerial=0;

    function fit(){
      if(!vrm||!host)return;
      const box=new THREE.Box3().setFromObject(vrm.scene);
      if(box.isEmpty()){
        setStatus('Saeed loaded, but the model has no visible geometry.');
        return;
      }
      const size=box.getSize(new THREE.Vector3());
      const center=box.getCenter(new THREE.Vector3());
      const h=Math.max(size.y,0.1);
      const fov=THREE.MathUtils.degToRad(camera.fov);
      const dist=(h*0.62)/Math.tan(fov/2);
      camera.position.set(center.x,center.y+h*0.03,center.z+Math.max(dist,0.5));
      camera.lookAt(center.x,center.y+h*0.03,center.z);
      camera.aspect=Math.max(0.1,host.clientWidth/Math.max(1,host.clientHeight));
      camera.updateProjectionMatrix();
    }

    function show(g:any,serial:number){
      if(cancelled||serial!==loadSerial)return;
      const loaded=g?.userData?.vrm as VRM|undefined;
      if(!loaded){
        const msg='VRM loaded but the VRM plugin did not create a model.';
        console.error('[Saeed]',msg,g);
        setStatus('3D error: VRM plugin did not create a model.');
        return;
      }

      if(vrm)scene.remove(vrm.scene);
      vrm=loaded;
      vrm.scene.visible=true;
      vrm.scene.traverse(o=>{o.visible=true});
      vrm.scene.rotation.y=Math.PI;
      scene.add(vrm.scene);
      try{setEmotion(vrm,'neutral')}catch(e){console.warn('[Saeed] expression setup failed:',e)}
      fit();
      setStatus('');
      console.info('[Saeed] VRM rendered successfully');
    }

    function fail(e:unknown,serial:number){
      if(cancelled||serial!==loadSerial)return;
      console.error('[Saeed] VRM load failed:',e);
      setStatus('3D error: Saeed VRM could not be loaded.');
    }

    async function loadModel(){
      const serial=++loadSerial;
      setStatus(vrm?'Changing Saeed character…':'Loading Saeed 3D…');
      try{
        const api=(window as any).electronAPI;
        if(!api?.loadAvatarModel)throw new Error('Saeed model IPC is unavailable');
        const data=await api.loadAvatarModel();
        if(cancelled||serial!==loadSerial)return;
        const bytes=data instanceof Uint8Array?data:new Uint8Array(data);
        const buffer=new ArrayBuffer(bytes.byteLength);
        new Uint8Array(buffer).set(bytes);
        console.info('[Saeed] received VRM bytes:',bytes.byteLength);
        loader.parse(buffer,'',(g)=>show(g,serial),(e)=>fail(e,serial));
      }catch(e){fail(e,serial)}
    }

    void loadModel();

    const api=(window as any).electronAPI;
    const removeAvatarChanged=api?.onAvatarChanged?.(()=>{void loadModel()})||(()=>{});

    const ro=new ResizeObserver(()=>{
      renderer.setSize(Math.max(1,host.clientWidth),Math.max(1,host.clientHeight));
      fit();
    });
    ro.observe(host);

    let id=0;
    const loop=()=>{
      id=requestAnimationFrame(loop);
      try{
        if(vrm)vrm.update(1/60);
        renderer.render(scene,camera);
      }catch(e){
        console.error('[Saeed] 3D render loop failed:',e);
        setStatus('3D error: '+(e instanceof Error?e.message:String(e)));
        vrm=undefined;
        try{renderer.dispose()}catch{}
        cancelAnimationFrame(id);
      }
    };
    loop();

    return()=>{
      cancelled=true;
      loadSerial++;
      removeAvatarChanged();
      cancelAnimationFrame(id);
      ro.disconnect();
      renderer.dispose();
      if(renderer.domElement.parentElement===host)host.removeChild(renderer.domElement);
    };
  },[]);

  return <div ref={ref} style={{position:'absolute',inset:0}}>
    {status&&<div style={{position:'absolute',left:'50%',bottom:'42%',transform:'translateX(-50%)',padding:'8px 12px',borderRadius:12,background:'rgba(10,10,15,.78)',color:'#fff',fontSize:12,whiteSpace:'nowrap',pointerEvents:'none'}}>{status}</div>}
  </div>;
}
