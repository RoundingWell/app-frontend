const { chromium } = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:950},timezoneId:'UTC'});
    const errors = [];
    const api = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => { api.push(route.request().url()); return route.abort(); });
    await page.goto('http://localhost:8081/.fe284-preview.html');
    await page.waitForFunction(() => window.previewReady);
    const rows = page.locator('#feed .patient-interactions__item');
    assert.equal(await rows.count(),5);
    assert.match(await rows.nth(0).innerText(), /Outbound SMS\s*•\s*4th of July Text Blast/, 'disposition-only outbound SMS is shown');
    assert.match(await rows.nth(1).innerText(), /Inbound SMS\s*•\s*Scheduling/);
    assert.equal(await rows.nth(1).locator('.patient-interactions__summary').innerText(),'Tuesday morning works for me.');
    assert.match(await rows.nth(2).innerText(), /Outbound SMS\s*•\s*Text Sent/);
    assert.equal(await rows.nth(2).locator('.patient-interactions__summary').innerText(),'Sent the appointment reminder.');
    assert.equal(await rows.nth(3).locator('.patient-interactions__card').count(),0);
    assert.match(await rows.nth(4).innerText(), /Outbound Voicemail\s*•\s*Left VM/);
    assert.deepEqual(await page.locator('.patient-interactions-preview__title').allTextContents(),[
      'Outbound Message • 4th of July Text Blast','Inbound Message • Scheduling','Outbound Message • Text Sent',
    ]);
    const cases = [
      {direction:'inbound',metadata:{disposition:'NP Visit Scheduled'}},
      {direction:'outbound',metadata:{disposition:'Text Sent',message:'Appointment confirmed.',note:'Fallback note'},summary:'Appointment confirmed.'},
      {direction:'inbound',metadata:{disposition:'Scheduling',body:'Tuesday works.',message:'Wrong direction',note:'Fallback note'},summary:'Tuesday works.'},
      {direction:'inbound',metadata:{disposition:'Scheduling',note:'Patient requested next week.'},summary:'Patient requested next week.'},
      {direction:'outbound',metadata:{message:'Ordinary message.'},summary:'Ordinary message.'},
      {direction:'inbound',metadata:{body:'Ordinary reply.'},summary:'Ordinary reply.'},
      {direction:'outbound',metadata:{}},
      {direction:'inbound',metadata:null},
      {direction:'outbound'},
      {direction:'outbound',metadata:{note:null,disposition:''}},
      {channel:'voice',direction:'inbound',metadata:{disposition:'Scheduling',note:'Call note.'},summary:'Call note.'},
      {channel:'voice',direction:'outbound',metadata:{}},
      {channel:'email',direction:'outbound',metadata:{note:'Email note.',disposition:'SMS-only change'},summary:'Email note.'},
      {direction:'outbound',metadata:{disposition:'<b>Scheduling</b> & follow-up',message:'<img src=x> & reply'},summary:'<img src=x> & reply'},
    ];
    await page.evaluate(cases => window.renderExtra(cases.map((row,index)=>({id:`case-${index}`,channel:'sms',...row}))),cases);
    assert.equal(await rows.count(),cases.length);
    for (let index=0;index<cases.length;index++) {
      const data=cases[index], row=rows.nth(index);
      if (data.channel==='voice' || data.metadata?.disposition && !data.channel) {
        assert.equal(await row.locator('.patient-interactions__item-heading').count(),1,`heading case ${index}`);
        if(data.metadata?.disposition) assert.ok((await row.innerText()).includes(data.metadata.disposition));
      } else assert.equal(await row.locator('.patient-interactions__item-heading').count(),0,`ordinary content case ${index}`);
      if(data.summary) assert.equal(await row.locator('.patient-interactions__summary').textContent(),data.summary,`payload case ${index}`);
      else assert.equal(await row.locator('.patient-interactions__summary').count(),0);
      if (!data.summary && !data.metadata?.disposition && data.channel!=='voice') assert.equal(await row.locator('.patient-interactions__card').count(),0,`empty case ${index}`);
    }
    assert.equal(await rows.last().locator('b,img').count(),0,'payload is escaped');
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(() => window.renderExtra([{channel:'sms',direction:'outbound',metadata:{disposition:'4th of July Text Blast',message:'Reminder '.repeat(60)}}]));
    await page.screenshot({path:'/workspace/fe284-evidence/after-mobile.png',fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow at 390px');
    assert.deepEqual(errors,[]);
    assert.deepEqual(api,[]);
    console.log('PASS: Chromium production-view assertions: 5 screenshot examples, 14 payload/card cases, preview titles, escaped text, 390px overflow. No API requests or page errors.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
