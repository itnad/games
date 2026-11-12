import { array, dictionary, enumeration, integer, object, text, type Infer } from "../core/validation";
const node = object({cell:integer(0,65535),g:integer(),h:integer()});
export const navigationJobSchema = object({entityId:integer(1),start:integer(0,65535),goal:integer(0,65535),best:integer(0,65535),radius:integer(1,512),layer:enumeration(["ground","air"]),version:integer(),open:array(node,0,65536),cost:dictionary(integer()),parent:dictionary(integer(0,65535)),closed:dictionary(integer(0,1))});
export type NavigationJob = { -readonly [K in keyof Infer<typeof navigationJobSchema>]: Infer<typeof navigationJobSchema>[K] };
export const navigationSchema = object({jobs:array(navigationJobSchema,0,4),cache:array(object({key:text,path:array(integer(0,65535),0,8192)}),0,64),obstacleSignature:text,lastReused:integer(0,2048),lastStarted:integer(0,4),lastExpanded:integer(0,8000)});
export type NavigationState = { -readonly [K in Exclude<keyof Infer<typeof navigationSchema>,"jobs">]: Infer<typeof navigationSchema>[K] } & {jobs:NavigationJob[]};
export const emptyNavigation = ():NavigationState=>({jobs:[],cache:[],obstacleSignature:"none",lastReused:0,lastStarted:0,lastExpanded:0});
