import type { SimulationState } from "./state";

const nativeRequired=Symbol("native clone required");
/** Copy the engine's plain data while retaining aliases, holes, cycles and signed zero. */
export function cloneSimulationState(state:SimulationState):SimulationState{
  const seen=new WeakMap<object,object>();
  const copy=(value:unknown,depth=0):unknown=>{
    if(depth>512)throw nativeRequired;
    if(value===null||typeof value!=="object"){
      if(typeof value==="function"||typeof value==="symbol")throw nativeRequired;
      return value;
    }
    const cached=seen.get(value);if(cached)return cached;
    const array=Array.isArray(value),prototype=Object.getPrototypeOf(value);
    if(!array&&prototype!==Object.prototype&&prototype!==null)throw nativeRequired;
    const result:Record<string,unknown>|unknown[]=array?new Array(value.length):{};
    seen.set(value,result);
    for(const key of Object.keys(value)){
      const entry=copy((value as Record<string,unknown>)[key],depth+1);
      if(key==="__proto__")Object.defineProperty(result,key,{value:entry,writable:true,enumerable:true,configurable:true});
      else (result as Record<string,unknown>)[key]=entry;
    }
    return result;
  };
  try{return copy(state) as SimulationState;}
  catch(error){
    if(error===nativeRequired)return structuredClone(state);
    throw error;
  }
}
