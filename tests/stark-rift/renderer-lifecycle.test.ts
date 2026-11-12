import { afterEach, describe, expect, it, vi } from "vitest";
import { createRiftBasin } from "../../app/stark-rift/data/maps";
const fake=vi.hoisted(()=>({apps:[] as {init:ReturnType<typeof vi.fn>;destroy:ReturnType<typeof vi.fn>;renderer:unknown}[],tickers:[] as {destroy:ReturnType<typeof vi.fn>}[],first:()=>Promise.resolve(),second:()=>Promise.resolve()}));
vi.mock("pixi.js",()=>{
  class Display {destroyed=false;destroy(){this.destroyed=true;}}
  class Application {
    renderer:unknown; init:ReturnType<typeof vi.fn>;destroy=vi.fn(()=>{this.renderer=undefined;});
    constructor(){const index=fake.apps.length;this.init=vi.fn(async()=>{await(index===0?fake.first():fake.second());this.renderer={};});fake.apps.push(this);}
  }
  class Ticker {destroy=vi.fn();constructor(){fake.tickers.push(this);}}
  return {Application,Container:Display,Graphics:Display,Sprite:Display,Texture:{},Ticker};
});
import { BattleRenderer } from "../../app/stark-rift/render/renderer";
afterEach(()=>{vi.unstubAllGlobals();fake.apps.length=0;fake.tickers.length=0;fake.first=()=>Promise.resolve();fake.second=()=>Promise.resolve();});
function renderer(){vi.stubGlobal("document",{createElement:()=>({})});vi.stubGlobal("devicePixelRatio",1);return new BattleRenderer(createRiftBasin(),{clientWidth:390,clientHeight:400} as HTMLElement,{} as HTMLElement,()=>{});}
describe("async renderer resource lifecycle",()=>{
  it("finishes disposing an application whose initialization was pending",async()=>{
    let resolve!:()=>void;fake.first=()=>new Promise<void>(r=>{resolve=r;});
    const r=renderer(),initializing=r.init();r.destroy();resolve();await initializing;
    expect(fake.apps[0].destroy).toHaveBeenCalledTimes(1);expect(fake.apps[1].init).not.toHaveBeenCalled();expect(fake.tickers[0].destroy).toHaveBeenCalledTimes(1);
    r.destroy();expect(fake.apps[0].destroy).toHaveBeenCalledTimes(1);
  });
  it("releases the first application and ticker when the minimap initialization fails",async()=>{
    fake.second=()=>Promise.reject(new Error("GPU unavailable"));const r=renderer();await expect(r.init()).rejects.toThrow("GPU unavailable");
    expect(fake.apps[0].destroy).toHaveBeenCalledTimes(1);expect(fake.tickers[0].destroy).toHaveBeenCalledTimes(1);
    r.destroy();expect(fake.apps[0].destroy).toHaveBeenCalledTimes(1);
  });
});
