import {useEffect,useRef} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRM} from '@pixiv/three-vrm';
import {setEmotion} from '../../avatar/expressions';

export function VRMAvatar(){
  const ref=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const host=ref.current;
    if(!host)return;

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(32,1,0.01,100);
    const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.setClearColor(0x000000,0);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cursor='grab';

    scene.add(new THREE.HemisphereLight(0xffffff,0x444444,2.2));
    const key=new THREE.DirectionalLight(0xffffff,1.4);
    key.position.set(1.5,3,4);
    scene.add(key);

    const loader=new GLTFLoader();
    loader.register(p=>new VRMLoaderPlugin(p));

    let vrm:VRM|undefined;
    let animationId=0;
    let cancelled=false;

    const disposeModel=(model?:VRM)=>{
      if(!model)return;
      model.scene.traverse((o:any)=>{
        o.geometry?.dispose?.();
        const materials=Array.isArray(o.material)?o.material:[o.material];
        for(const m of materials)if(m){
          for(const k of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap'])m[k]?.dispose?.();
          m.dispose?.();
        }
      });
      scene.remove(model.scene);
    };

    const fitCamera=(model:VRM)=>{
      const box=new THREE.Box3().setFromObject(model.scene);
      if(box.isEmpty())return;
      const size=box.getSize(new THREE.Vector3());
      const center=box.getCenter(new THREE.Vector3());
      const aspect=Math.max(0.2,host.clientWidth/Math.max(1,host.clientHeight));
      camera.aspect=aspect;
      const vertical=Math.max(size.y,size.x/aspect);
      const distance=(vertical/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))))*1.28;
      camera.near=Math.max(0.01,distance/100);
      camera.far=Math.max(100,distance*20);
      camera.position.set(center.x,center.y+size.y*0.02,center.z+distance);
      camera.lookAt(center.x,center.y+size.y*0.02,center.z);
      camera.updateProjectionMatrix();
    };

    const loadCurrent=async()=>{
      try{
        const bytes=await window.electronAPI.loadAvatarModel();
        if(cancelled)return;
        const ab=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
        loader.parse(ab,'',gltf=>{
          if(cancelled)return;
          const next=gltf.userData.vrm as VRM|undefined;
          if(!next)throw new Error('VRM plugin did not create a model');
          disposeModel(vrm);
          vrm=next;
          // VRM's canonical forward is -Z and the camera is placed on +Z looking toward the model.
          // Do not rotate the model 180°: that makes the avatar show its back.
          vrm.scene.rotation.y=0;
          scene.add(vrm.scene);
          setEmotion(vrm,'neutral');
          fitCamera(vrm);
        },e=>console.error('[Saeed] VRM parse failed',e));
      }catch(e){console.error('[Saeed] VRM load failed',e);}
    };

    const resize=()=>{renderer.setSize(Math.max(1,host.clientWidth),Math.max(1,host.clientHeight));if(vrm)fitCamera(vrm);};
    const ro=new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let dragging=false;
    let lastX=0,lastY=0;
    const down=(e:PointerEvent)=>{
      if(e.button!==0)return;
      dragging=true;lastX=e.screenX;lastY=e.screenY;renderer.domElement.style.cursor='grabbing';
      try{host.setPointerCapture(e.pointerId)}catch{}
    };
    const move=(e:PointerEvent)=>{
      if(!dragging)return;
      const dx=e.screenX-lastX,dy=e.screenY-lastY;
      if(dx||dy){lastX=e.screenX;lastY=e.screenY;void window.electronAPI.moveWindowBy(dx,dy);}
    };
    const up=()=>{dragging=false;renderer.domElement.style.cursor='grab';};
    host.addEventListener('pointerdown',down);
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);

    const onAvatarChanged=window.electronAPI.onAvatarChanged(()=>{void loadCurrent();});
    void loadCurrent();

    const loop=()=>{
      animationId=requestAnimationFrame(loop);
      vrm?.update(1/60);
      renderer.render(scene,camera);
    };
    loop();

    return()=>{
      cancelled=true;
      cancelAnimationFrame(animationId);
      onAvatarChanged?.();
      ro.disconnect();
      host.removeEventListener('pointerdown',down);
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',up);
      disposeModel(vrm);
      vrm=undefined;
      renderer.dispose();
      if(renderer.domElement.parentElement===host)host.removeChild(renderer.domElement);
    };
  },[]);

  return <div ref={ref} style={{position:'absolute',inset:0,userSelect:'none'}}/>;
}
