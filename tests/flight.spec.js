import { test, expect } from '@playwright/test';

async function seedField(page,seed=31) {
 await page.addInitScript(seed=>{
  const original=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=array=>{if(array instanceof Uint32Array&&array.length===1){array[0]=seed;return array;}return original(array);};
 },seed);
}

test('flight offers only coherence and rescue, with read-only weather and an always-on trail',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await seedField(page);await page.goto('http://127.0.0.1:5173');
 await expect(page.locator('#score-output')).toBeVisible();
 await expect.poll(async()=>Number((await page.locator('#score-output').textContent()).replaceAll(',',''))).toBeGreaterThan(0);
 await expect(page.locator('#score-rate')).toHaveText(/\+[0-9]+\.[0-9] pts \/ s/);
 await expect(page.locator('canvas')).toBeVisible();await expect(page.locator('#error')).toBeHidden();
 const controls=page.getByRole('region',{name:'Flight controls'});
 await expect(controls.getByRole('slider')).toHaveCount(1);
 await expect(controls.getByRole('button')).toHaveCount(1);
 await expect(page.getByRole('switch')).toHaveCount(0);
 await expect(page.getByRole('meter',{name:'Instability',exact:true})).toBeVisible();
 await expect(page.getByRole('meter',{name:'Fuel',exact:true})).toBeVisible();
 await expect(page.locator('#fuel-rate')).toHaveText(/−[0-9]+\.[0-9]{2}% \/ s/);
 await expect(page.getByRole('button',{name:'Rescue boost',exact:true})).toBeDisabled();
 const coherence=page.getByRole('slider',{name:'Stabilizer engines',exact:true});
 await coherence.fill('100');await expect(page.locator('#coherence-output')).toHaveText('100%');
 await page.waitForTimeout(1200);await page.screenshot({path:'test-results/coherence-transition.png'});
 await coherence.fill('0');await expect(page.locator('#coherence-output')).toHaveText('0%');
 await page.getByRole('button',{name:'About this experiment'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await page.screenshot({path:'test-results/desktop.png'});expect(errors).toEqual([]);
});

test('mobile controls and the right-hand weather indicator fit the viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seedField(page);
 await page.goto('http://127.0.0.1:5173');
 await expect(page.getByRole('slider',{name:'Stabilizer engines',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Rescue boost',exact:true})).toBeVisible();
 const meter=page.getByRole('meter',{name:'Instability',exact:true});await expect(meter).toBeVisible();
 expect((await meter.boundingBox()).x).toBeGreaterThan(300);
 expect((await page.getByRole('meter',{name:'Fuel',exact:true}).boundingBox()).x).toBeLessThan(90);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/mobile.png'});
});

test('refresh and restored form values stay synchronized with coherence defaults',async({page})=>{
 await seedField(page);await page.goto('http://127.0.0.1:5173');
 const coherence=page.getByRole('slider',{name:'Stabilizer engines',exact:true});await coherence.fill('100');
 await page.reload();await expect(coherence).toHaveValue('0');
 await expect(page.locator('#coherence-output')).toHaveText('0%');
 expect(await coherence.evaluate(el=>el.style.getPropertyValue('--fill'))).toBe('0%');
 await page.evaluate(()=>{document.getElementById('coherence').value='91';window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
 await expect(coherence).toHaveValue('0');
});

test('a real seeded lock loss enables rescue and the burn recovers control',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await seedField(page,6511);await page.goto('http://127.0.0.1:5173');
 const rescue=page.getByRole('button',{name:'Rescue boost',exact:true});
 await expect(rescue).toBeEnabled({timeout:15000});
 await page.getByRole('slider',{name:'Stabilizer engines',exact:true}).fill('100');
 await page.waitForTimeout(1000);await expect(rescue).toBeEnabled();
 await rescue.click();await expect(rescue).toBeDisabled();
 await expect(rescue).toHaveText(/Boosting · [0-9]+s/);
 await expect(rescue).toHaveText(/Rescue boost · [0-9]+s/,{timeout:30000});
 await expect(rescue).toBeDisabled();expect(errors).toEqual([]);
});


test('stabilizer lever moves vertically with pointer and keyboard input',async({page})=>{
 await seedField(page);await page.goto('http://127.0.0.1:5173');
 const lever=page.getByRole('slider',{name:'Stabilizer engines',exact:true});
 await expect(lever).toHaveAttribute('aria-orientation','vertical');
 const box=await lever.boundingBox();expect(box.height).toBeGreaterThan(box.width*2);
 await page.mouse.move(box.x+box.width/2,box.y+box.height*.9);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2,box.y+box.height*.1,{steps:10});await page.mouse.up();
 expect(Number(await lever.inputValue())).toBeGreaterThan(80);
 await page.mouse.move(box.x+box.width/2,box.y+box.height*.1);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2,box.y+box.height*.9,{steps:10});await page.mouse.up();
 expect(Number(await lever.inputValue())).toBeLessThan(20);
 await lever.focus();await page.keyboard.press('Home');await expect(lever).toHaveValue('0');
 await page.keyboard.press('ArrowUp');await expect(lever).toHaveValue('1');
});


test('engine consumption eases with the lever and empty fuel shows a central warning',async({page})=>{
 await seedField(page);await page.goto('http://127.0.0.1:5173');
 const usage=page.locator('#engine-fuel-rate'),warning=page.locator('#out-of-fuel-notice');
 await expect(usage).toHaveText('−0.03% / s');await expect(warning).toBeHidden();
 await page.getByRole('slider',{name:'Stabilizer engines',exact:true}).fill('20');
 await expect.poll(async()=>Number((await usage.textContent()).match(/[0-9.]+/)[0])).toBeLessThan(3);
 await page.reload();
 await page.getByRole('slider',{name:'Stabilizer engines',exact:true}).fill('100');
 await expect(warning).toBeVisible({timeout:45000});
 await expect(warning.locator('strong')).toHaveText('OUT OF FUEL');await expect(usage).toHaveText('−0.00% / s');
 await expect(page.locator('#refueling-notice')).toBeHidden();
 const box=await warning.boundingBox();
 expect(Math.abs(box.x+box.width/2-720)).toBeLessThan(2);
 const lever=page.getByRole('slider',{name:'Stabilizer engines',exact:true});
 await expect(lever).toBeDisabled();
 const score=await page.locator('#score-output').textContent();
 await expect(page.locator('#score-rate')).toHaveText('+0.0 pts / s');
 // A stale/programmatic input event cannot change the exhausted engine setting.
 await lever.evaluate(el=>{el.value='20';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(lever).toHaveValue('100');
 await page.waitForTimeout(1000);
 await expect(page.locator('#score-output')).toHaveText(score);
 await page.screenshot({path:'test-results/out-of-fuel.png'});
 await page.getByRole('button',{name:'Restart flight',exact:true}).click();
 await expect(warning).toBeHidden();await expect(lever).toBeEnabled();await expect(lever).toHaveValue('0');
 expect(Number((await page.locator('#score-output').textContent()).replaceAll(',',''))).toBeLessThan(15);
 expect(Number((await page.locator('#fuel-output').textContent()).replace('%',''))).toBeGreaterThan(95);
});


test('live random weather marks elevated yellow and high instability explicitly',async({page})=>{
 await page.addInitScript(()=>{
  let calls=0;const original=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=array=>{
   if(array instanceof Uint32Array&&array.length===1){
    calls++;array[0]=calls===1?31:calls===2?0:0xffffffff;return array;
   }
   return original(array);
  };
 });
 await page.goto('http://127.0.0.1:5173');
 const panel=page.locator('#instability-panel');
 await expect(panel).toHaveAttribute('data-level','elevated',{timeout:5000});
 await expect(page.locator('#instability-output')).toHaveCSS('color','rgb(230, 203, 112)');
 await expect(panel).toHaveAttribute('data-level','high',{timeout:5000});
 await expect(page.locator('#instability-level')).toHaveText('HIGH');
 await expect(page.locator('#instability-meter')).toHaveAttribute('aria-valuetext',/high/);
 await page.screenshot({path:'test-results/high-instability.png'});
});

test('forecast worker reports a refueling encounter for blue route rendering',async({page})=>{
 await seedField(page);await page.goto('http://127.0.0.1:5173');
 const result=await page.evaluate(async()=>{
  const {Navigation}=await import('/src/navigation.js');
  const {Journey}=await import('/src/journey.js');
  const {flightRoute}=await import('/src/flight-route.js');
  const route=flightRoute(1.05,7),navigation=new Navigation();navigation.fuel=50;
  const worker=new Worker('/src/prediction-worker.js',{type:'module'});
  try {
   return await new Promise((resolve,reject)=>{
    worker.onerror=event=>reject(new Error(event.message));
    worker.onmessage=({data})=>resolve({willRefuel:data.willRefuel,count:new Float32Array(data.positions).length});
    worker.postMessage({version:1,elapsed:0,snapshot:{
     position:route,velocity:route.velocity,navigation,journey:new Journey(),
     bodies:[{id:7,kind:'station',x:20,y:0,z:0,radius:3,mass:3,vx:-8}],
     phase:1.05,radius:7,targetRadius:7,instability:.5,speed:1.5,
    }});
   });
  }finally{worker.terminate();}
 });
 expect(result.willRefuel).toBe(true);expect(result.count).toBeGreaterThan(100);
});


test('an upcoming fork is announced without automatically changing the selected beam',async({page})=>{
 test.setTimeout(90000); // Software rendering may advance the capped simulation slower than wall time.
 await seedField(page,2);await page.goto('http://127.0.0.1:5173');
 await page.getByRole('slider',{name:'Stabilizer engines',exact:true}).fill('20');
 await expect(page.locator('#beam-choice')).toHaveText('Fork ahead · click a branch to follow',{timeout:70000});
 await page.waitForTimeout(4500);
 await expect(page.locator('#out-of-fuel-notice')).toBeHidden();
 await page.screenshot({path:'test-results/upcoming-fork.png'});
});


test('visible interface text is at least sixteen pixels on desktop and mobile',async({page})=>{
 await seedField(page);await page.goto('http://127.0.0.1:5173');
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  const small=await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>
   [...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'
   &&parseFloat(getComputedStyle(el).fontSize)<16).map(el=>({text:el.textContent.trim(),font:getComputedStyle(el).fontSize})));
  expect(small).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.screenshot({path:'test-results/mobile-readable.png'});
 await page.getByRole('button',{name:'About this experiment'}).click();
 const dialogSmall=await page.getByRole('dialog').evaluate(el=>[...el.querySelectorAll('*')].filter(child=>child.textContent.trim()&&parseFloat(getComputedStyle(child).fontSize)<16).length);
 expect(dialogSmall).toBe(0);
});
