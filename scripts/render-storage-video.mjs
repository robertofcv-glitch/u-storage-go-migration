// Reproducible upbeat edit; both previous completed cuts remain untouched.
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const dir = 'attached_assets/video-upbeat';
const durations = [7, 8, 7, 8, 8, 8];
const starts = durations.map((_, i) => durations.slice(0, i).reduce((a,b)=>a+b,0));
const duration = durations.reduce((a,b)=>a+b,0);
// Local scene windows; logo and backing are one alpha-faded asset.
const logoWindows = {0:[0.25,4.75],4:[0.25,3.75],5:[2,7.75]};
const fade = 0.375;
await mkdir(dir, { recursive: true });
const ff = args => execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y',...args], { stdio: 'inherit' });
const font = 'client/public/brand/v1/fonts/montserrat-regular.ttf';
const bold = 'client/public/brand/v1/fonts/montserrat-semibold.ttf';
const sources = [
  'attached_assets/generated_videos/ugo_scene_1.mp4',
  'attached_assets/generated_videos/ugo_refresh_scene_2.mp4',
  'attached_assets/generated_videos/ugo_refresh_scene_3_corrected.mp4',
  'attached_assets/generated_videos/ugo_refresh_scene_4_corrected.mp4',
  'attached_assets/generated_videos/ugo_refresh_scene_5_corrected.mp4',
  'attached_assets/generated_videos/ugo_refresh_scene_6.mp4',
];
const titles = [
  'Traslados hacia y desde U-Storage',
  'De tu espacio a tu bodega',
  'Llegamos a U-Storage',
  'Espacio y coordinación',
  'De U-Storage, de regreso a ti',
  'Solicita tu cotización',
];
const captions = [
  ['Ahora no solo guardamos tus cosas.', 'También te ayudamos a llevarlas.'],
  ['Llevamos tus cosas a U-Storage, con coordinación humana', 'y cuidado en cada detalle.'],
  ['De tu espacio a U-Storage.', 'Coordinamos el traslado hasta tu bodega.'],
  ['U-Storage ofrece el espacio.', 'U-Storage Go coordina el traslado.'],
  ['Cuando las necesitas, recogemos tus cosas en U-Storage', 'para llevarlas de regreso.'],
  ['O a tu nuevo espacio.', 'Solicita tu cotización con U-Storage Go.'],
];
const logo = await sharp('client/public/brand/v1/logos/official-color.svg').resize(300).png().toBuffer();
await sharp({create:{width:348,height:86,channels:4,background:'#FBF9F6'}})
  .composite([{input:logo,left:24,top:22}]).png().toFile(`${dir}/logo.png`);
for(let i=0;i<6;i++){
  const n=i+1;
  const window = logoWindows[i];
  await writeFile(`${dir}/title-${n}.txt`, titles[i]);
  await writeFile(`${dir}/caption-${n}.txt`, captions[i].join('\n'));
  const direction = i===0 ? 'HACIA Y DESDE TU BODEGA' : i<4 ? 'HACIA U-STORAGE' : 'DESDE U-STORAGE';
  await writeFile(`${dir}/direction-${n}.txt`, direction);
  const filter = [
    '[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=24',
    'drawbox=x=0:y=516:w=1280:h=204:color=0x24152E@0.92:t=fill',
    'drawbox=x=48:y=542:w=62:h=4:color=0xFF6C00:t=fill',
    `drawtext=fontfile=${bold}:textfile=${dir}/title-${n}.txt:fontsize=38:fontcolor=white:x=48:y=562`,
    `drawtext=fontfile=${font}:textfile=${dir}/caption-${n}.txt:fontsize=28:line_spacing=9:fontcolor=white:x=48:y=620:enable='between(t,0.5,${durations[i]-.25})'`,
    'drawbox=x=814:y=32:w=418:h=48:color=0x4E2069@0.96:t=fill',
    `drawtext=fontfile=${bold}:textfile=${dir}/direction-${n}.txt:fontsize=21:fontcolor=white:x=834:y=46[${window?'v':'out'}]`,
  ].join(',') + (window
    ? `;[1:v]format=rgba,fade=t=in:st=${window[0]}:d=${fade}:alpha=1,fade=t=out:st=${window[1]-fade}:d=${fade}:alpha=1[logo];[v][logo]overlay=32:32:shortest=1[out]`
    : '');
  ff(['-i',sources[i],
    ...(window?['-loop','1','-framerate','24','-i',`${dir}/logo.png`]:[]),
    '-filter_complex',filter,'-map','[out]','-an','-t',String(durations[i]),
    '-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p',`${dir}/edit-${n}.mp4`]);
}
await writeFile(`${dir}/concat.txt`,Array.from({length:6},(_,i)=>`file 'edit-${i+1}.mp4'`).join('\n'));
ff(['-f','concat','-safe','0','-i',`${dir}/concat.txt`,'-c','copy',`${dir}/picture.mp4`]);
const inputs = ['-i',`${dir}/picture.mp4`];
for(let i=1;i<=6;i++) {
  ff(['-i',`attached_assets/generated_audio/ugo_refresh_vo_${i}.mp3`,
    '-af','loudnorm=I=-17:TP=-2:LRA=7','-ar','48000','-ac','2',`${dir}/voice-${i}.wav`]);
  inputs.push('-i',`${dir}/voice-${i}.wav`);
}
ff(['-i','attached_assets/generated_audio/ugo_upbeat_music.mp3',
  '-af','loudnorm=I=-25:TP=-3:LRA=6','-ar','48000','-ac','2',`${dir}/music.wav`]);
inputs.push('-i',`${dir}/music.wav`);
const audio = [];
for(let i=1;i<=6;i++) audio.push(`[${i}:a]adelay=${starts[i-1]*1000+500}:all=1[a${i}]`);
audio.push(`[a1][a2][a3][a4][a5][a6]amix=inputs=6:duration=longest:normalize=0,apad,atrim=duration=${duration},asplit=2[voice][key]`);
audio.push(`[7:a]atrim=duration=${duration},afade=t=in:d=0.25,afade=t=out:st=${duration-1.5}:d=1.5[bed]`);
audio.push('[bed][key]sidechaincompress=threshold=0.035:ratio=4:attack=15:release=250:makeup=1[m]');
audio.push('[voice][m]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.89:level=0[a]');
const output='client/public/intro-video-storage-upbeat.mp4';
ff([...inputs,'-filter_complex',audio.join(';'),'-map','0:v','-map','[a]','-t',String(duration),
  '-c:v','copy','-c:a','aac','-ar','48000','-b:a','192k','-movflags','+faststart',output]);
ff(['-ss','31','-i',output,'-frames:v','1','-q:v','2','client/public/intro-video-storage-upbeat.jpg']);
await copyFile(output,`${dir}/U-Storage-Go-traslados-upbeat.mp4`);
await writeFile(`${dir}/edit-manifest.json`,JSON.stringify({
  duration,width:1280,height:720,fps:24,original:'client/public/intro-video.mp4',
  previous:'client/public/intro-video-storage-transfers.mp4',
  output,sources,titles,captions,durations,starts,narrationStartOffsets:starts.map(t=>t+.5),
  logoWindows:Object.entries(logoWindows).map(([i,w])=>({start:starts[i]+w[0],end:starts[i]+w[1],fadeSeconds:fade})),
  music:'attached_assets/generated_audio/ugo_upbeat_music.mp3',musicTargetBpm:120,
  note:'AI-generated illustrative footage and narration. Official logo composited from approved SVG. Original corporate references are unchanged.',
},null,2));
console.log(`Rendered ${output}`);