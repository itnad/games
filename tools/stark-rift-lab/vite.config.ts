import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {sourceIdentity} from './source-identity.mjs';
export default defineConfig(async()=>({define:{__LAB_SOURCE__:JSON.stringify(await sourceIdentity())},root:fileURLToPath(new URL('.',import.meta.url)),base:'./',server:{host:'127.0.0.1',port:4174,strictPort:true,fs:{allow:[fileURLToPath(new URL('../..',import.meta.url))]}},build:{outDir:'../../work/stark-rift-lab/dist',emptyOutDir:true},worker:{format:'es' as const}}));
