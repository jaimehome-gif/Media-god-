import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';

const base=process.env.STAGING_URL || 'https://media-god-independent-web-production.up.railway.app';
const chrome=process.env.CHROME_BIN || '/usr/bin/google-chrome';
const browser=await puppeteer.launch({
  executablePath:chrome,
  headless:true,
  args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
});
const page=await browser.newPage();
await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
const uncaught=[];
page.on('pageerror',e=>uncaught.push(e.message));
async function visit(path,expected) {
  const url=new URL(path,base);
  const result=await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:25000});
  assert.equal(result.status(),200,path+' must serve HTTP 200');
  await page.waitForFunction(
    (value)=>document.body?.innerText?.includes(value),
    {timeout:25000},
    expected
  );
  assert.equal(uncaught.length,0,'No runtime exceptions during '+path+': '+uncaught.join('; '));
  console.log('ok',path,expected);
}
try {
  await visit('/login','Welcome to Media God');
  assert.equal(await page.$('input[type="password"]').then(x=>x.length),1,'login has password field');
  for (const provider of ['Google','Facebook','Microsoft','Apple']) {
    const label=provider+' sign-in not yet configured';
    assert.ok(await page.$('[aria-label="'+label+'"]') ||
      await page.$('[aria-label="Continue with '+provider+'"]'),
      provider+' choice must appear even when credentials are pending');
  }
  const browse=await page.evaluate(()=>document.body.innerText);
  assert.match(browse,/Browse without signing in/, 'Original skip option preserved');
  await visit('/register','Create Media God account');
  assert.equal(await page.$('input[type="password"]').then(x=>x.length),2,'registration has confirm password');
  for (const provider of ['Google','Facebook','Microsoft','Apple']) {
    assert.ok(await page.evaluate((name)=>document.body.innerText.includes(name),provider),
      provider+' sign-up must appear');
  }
  await visit('/auth/callback','Social login was interrupted');
  const brand=await page.title();
  assert.match(brand,/Media God/i,'staged browser title must not be Base44');
}finally{
  await browser.close();
}
