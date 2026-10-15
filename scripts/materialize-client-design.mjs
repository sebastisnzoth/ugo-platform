import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {join} from 'node:path'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const root=process.cwd()
const sources=[
 {input:'UgoClient.tsx',parts:5,output:'UgoClient.tsx',sha:'1b0e5880368a4bed089a8d5899cbe36ca145511be4f711a2847a354289855e44'},
 {input:'ugo-original.css',parts:4,output:'ugo-original.css',sha:'dc56154e672e6eeaf98319c6bb81558dcbdcf7190f3c9d45732f8a2f2aaf5740'}
]
mkdirSync(join(root,'src','exact'),{recursive:true})
for(const item of sources){
 const encoded=Array.from({length:item.parts},(_,index)=>
  readFileSync(join(root,'design-source',item.input+'.gz.b64.'+(index+1)),'utf8').trim()
 ).join('')
 const restored=gunzipSync(Buffer.from(encoded,'base64'))
 const checksum=createHash('sha256').update(restored).digest('hex')
 if(checksum!==item.sha)throw new Error('El ZIP original no coincide para '+item.output+'; esperado '+item.sha+' recibido '+checksum)
 writeFileSync(join(root,'src','exact',item.output),item.output.endsWith('.tsx') ? Buffer.concat([Buffer.from('// @ts-nocheck\n'),restored]) : restored)
 process.stdout.write('Restaurado original '+item.output+' ('+restored.length+' bytes), SHA256 OK\n')
}
