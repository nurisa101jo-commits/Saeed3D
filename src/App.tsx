import {AvatarScene} from './components/Avatar/AvatarScene';
import {Chat} from './components/Chat/Chat';
import {Controls} from './components/Controls/Controls';
import {Settings} from './components/Settings/Settings';
import {UpdateStatus} from './components/Controls/UpdateStatus';
import {AppState} from './state/appStore';
import './styles/app.css';

export default function App(){
  const settingsWindow=new URLSearchParams(window.location.search).get('settings')==='1';
  if(settingsWindow)return <AppState><Settings standalone/></AppState>;
  return <AppState><main><AvatarScene/><div className="top"><Controls/></div><Chat/><UpdateStatus/></main></AppState>
}