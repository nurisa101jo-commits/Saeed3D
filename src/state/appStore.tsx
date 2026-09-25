import {createContext,useContext,useState} from 'react';

type AppStateValue = {
  clickThrough: boolean;
  setClickThrough: (value: boolean) => void;
};

const C=createContext<AppStateValue | null>(null);

export function AppState({children}:{children:React.ReactNode}){
  const [clickThrough,setClickThrough]=useState(false);
  return <C.Provider value={{clickThrough,setClickThrough}}>{children}</C.Provider>;
}

export const useAppState=()=>{
  const value=useContext(C);
  if(!value) throw new Error('useAppState must be used inside AppState');
  return value;
};
