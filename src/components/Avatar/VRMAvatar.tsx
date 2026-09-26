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
    const camera=new THREE.PerspectiveCamera(24,1,0.01,100);
    const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.setSize(Math.max(1,host.clientWidth),Math.max(1,host.clientHeight));
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff,0x444444,1.8));
    const key=new THREE.DirectionalLight(0xffffff,1.5);
    key.position.set(1,2,3);
    scene.add(key);

    const loader=new GLTFLoader();
    loader.register(p=>new VRMLoaderPlugin(p));
    let vrm:VRM|undefined;
    let cancelled=false;

    function fit(){
      if(!vrm||!host)return;
      const box=new THREE.Box3().setFromObject(vrm.scene);
      if(box.isEmpty())return;
      const size=box.getSize(new THREE.Vector3());
      const center=box.getCenter(new THREE.Vector3());
      const h=Math.max(size.y,0.1);
      const fov=THREE.MathUtils.degToRad(camera.fov);
      const dist=(h*0.62)/Math.tan(fov/2);
      camera.position.set(center.x,center.y+h*0.03,center.z+dist);
      camera.lookAt(center.x,center.y+h*0.03,center.z);
      camera.aspect=Math.max(0.1,host.clientWidth/Math.max(1,host.clientHeight));
      camera.updateProjectionMatrix();
    }

    const show=(g:any)=>{
      if(cancelled)return;
      const loaded=g.userData.vrm as VRM|undefined;
      if(!loaded){console.error('[Saeed] VRM plugin returned no VRM',g);return;}
      vrm=loaded;
      vrm.scene.visible=true;
      vrm.scene.rotation.y=Math.PI;
      scene.add(vrm.scene);
      setEmotion(vrm,'neutral');
      fit();
      console.info('[Saeed] VRM rendered successfully');
    };

    const fail=(e:unknown)=>{
      if(!cancelled)console.error('[Saeed] VRM load failed:',e);
    };

    // Packaged Electron builds load the model through the main process.
    // This avoids file:// / ASAR path restrictions in the renderer.
    const api=(window as any).electronAPI;
    if(api?.loadAvatarModel){
      api.loadAvatarModel()
        .then((data:Uint8Array)=>{
          if(cancelled)return;
          const bytes=data instanceof Uint8Array?data:new Uint8Array(data);
          loader.parse(bytes.buffer,'',show,fail);
        })
        .catch(fail);
    }else{
      const url=new URL('./models/saeed.vrm',window.location.href).href;
      loader.load(url,show,undefined,fail);
    }

    const ro=new ResizeObserver(()=>{
      renderer.setSize(Math.max(1,host.clientWidth),Math.max(1,host.clientHeight));
      fit();
    });
    ro.observe(host);

    let id=0;
    const loop=()=>{
      id=requestAnimationFrame(loop);
      if(vrm)vrm.update(1/60);
      renderer.render(scene,camera);
    };
    loop();

    return()=>{
      cancelled=true;
      cancelAnimationFrame(id);
      ro.disconnect();
      renderer.dispose();
      if(renderer.domElement.parentElement===host)host.removeChild(renderer.domElement);
    };
  },[]);

  return <div ref={ref} style={{position:'absolute',inset:0}}/>;
}