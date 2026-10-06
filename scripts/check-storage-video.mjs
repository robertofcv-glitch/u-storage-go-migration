import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const file = 'client/public/intro-video-storage-upbeat.mp4';
const info = JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));
assert.equal(Number(info.format.duration),46);
const v=info.streams.find(s=>s.codec_type==='video');
assert.equal(v.width,1280); assert.equal(v.height,720); assert.equal(v.codec_name,'h264');
assert.equal(v.avg_frame_rate,'24/1');
assert.equal(info.streams.find(s=>s.codec_type==='audio').codec_name,'aac');
assert(Math.abs(Number(info.streams.find(s=>s.codec_type==='audio').duration)-46)<.1,'Audio must span the entire edit');
execFileSync('ffmpeg',['-v','error','-i',file,'-f','null','-'],{stdio:'inherit'});
const browser=await chromium.launch({executablePath:'/repl/tools/bin/chromium',headless:true,args:['--no-sandbox']});
const results=[];
try {
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:name==='mobile',hasTouch:name==='mobile'});
    const page=await context.newPage();
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/`,{waitUntil:'domcontentloaded'});
    const video=page.getByTestId('intro-video');
    await video.scrollIntoViewIfNeeded();
    await video.evaluate(async el=>{
      el.muted=true;
      await el.play();
    });
    await page.waitForFunction(()=>document.querySelector('[data-testid="intro-video"]').currentTime>1);
    const properties=await video.evaluate(el=>({duration:el.duration,width:el.videoWidth,height:el.videoHeight,inline:el.playsInline,src:el.currentSrc,error:el.error}));
    assert.equal(properties.duration,46); assert.equal(properties.width,1280); assert.equal(properties.height,720);
    assert(properties.src.endsWith('/intro-video-storage-upbeat.mp4'));
    assert.equal(properties.inline,true); assert.equal(properties.error,null);
    for(const time of [1,6,19,31,35,39,42,45.9]){
      await video.evaluate((el,t)=>{el.currentTime=t;},time);
      await page.waitForFunction(t=>{const el=document.querySelector('[data-testid="intro-video"]');return !el.seeking && el.currentTime>=t && el.readyState>=2;},time);
      await page.screenshot({path:`attached_assets/video-upbeat/${name}-${time}.jpg`});
    }
    await video.evaluate(el=>{el.currentTime=44;});
    await page.waitForFunction(()=>document.querySelector('[data-testid="intro-video"]').ended,{},{timeout:10000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    results.push({name,...properties,seekingAndPlayback:'passed',horizontalOverflow:false});
    await context.close();
  }
} finally {await browser.close();}
await writeFile('attached_assets/video-upbeat/playback-check.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));