import {describe,expect,it,vi} from "vitest";
import type {Graphics} from "pixi.js";
import {updateMinimapMarker,updateUnitMarker} from "../../app/stark-rift/render/marker-visual";
function marker(){return {clear:vi.fn().mockReturnThis(),rect:vi.fn().mockReturnThis(),circle:vi.fn().mockReturnThis(),fill:vi.fn().mockReturnThis(),stroke:vi.fn().mockReturnThis()};}
describe("reusable marker geometry",()=>{
  it("keeps geometry across thousands of position-only frames and rebuilds on appearance changes",()=>{
    const g=marker(),graphics=g as unknown as Graphics;
    for(let frame=0;frame<2000;frame++)updateUnitMarker(graphics,0x64dce0,false,0x80ffaa,40);
    expect(g.clear).toHaveBeenCalledTimes(1);expect(g.circle).toHaveBeenCalledTimes(2);
    updateUnitMarker(graphics,0x64dce0,true,0x80ffaa,40);
    expect(g.rect).toHaveBeenCalledTimes(1);
    updateUnitMarker(graphics,0x64dce0,true,0xffd479,40);
    expect(g.stroke).toHaveBeenLastCalledWith({width:.06,color:0xffd479});
    updateUnitMarker(graphics,0xf57278,true,null,80);
    expect(g.clear).toHaveBeenCalledTimes(4);expect(g.stroke).toHaveBeenCalledTimes(3);
  });
  it("keeps separate minimap markers cached and redraws a pooled marker for a new owner",()=>{
    const a=marker(),b=marker();
    for(let frame=0;frame<2000;frame++){
      updateMinimapMarker(a as unknown as Graphics,0x64dce0);
      updateMinimapMarker(b as unknown as Graphics,0xf57278);
    }
    expect(a.clear).toHaveBeenCalledTimes(1);expect(b.clear).toHaveBeenCalledTimes(1);
    updateMinimapMarker(a as unknown as Graphics,0xf57278);
    expect(a.clear).toHaveBeenCalledTimes(2);expect(a.fill).toHaveBeenLastCalledWith(0xf57278);
  });
});
