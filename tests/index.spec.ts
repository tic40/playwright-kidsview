import { test, expect } from '@playwright/test';

async function sendToSlack(username, text) {
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL as string;
  const data = { text, username }
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
  try {
    const response = await fetch(slackWebhookUrl, options);
    if (response.ok) {
      console.log('Message sent to Slack');
    } else {
      console.error('Error sending message to Slack:', await response.text());
    }
  } catch (error) {
    console.error('Error sending message to Slack:', error);
  }
}

test('get enyori and notify slack', async ({ page }) => {

  await page.goto(process.env.KIDS_VIEW_LOGIN_URL as string);
  // login
  const id = await page.$('input[name="txtID"]')
  await id?.type(process.env.KIDS_VIEW_ID as string);
  const pw = await page.$('input[name="txtPASS"]')
  await pw?.type(process.env.KIDS_VIEW_ID as string);
  await page.getByRole("button", { name: "ログイン" }).click();

  // move to 園より
  await page.locator('#grdMENU_ctl02_lnk02').click();
  const res = await page.locator('#pnlENJINOYOUSU');
  await expect(res).toBeVisible();

  // debug: 前日
  await page.locator('#cmdBEFORE').click();

  const scraypeMessageEnyori = async () => {
    const ELM_MAP = {
      '体温': '#lblTEMPERATURE1',
      '睡眠': '#lblGOSUI',
      '機嫌': '#lblMOOD',
      '食事': '#lblMEAL',
      '排泄': '#lblEXCRETION1',
      'コメント': '#lblCOMMENT',
      '記入者': '#lblSTAFF_NAME',
    }
    let res: string[] = []
    for(const [k,v] of Object.entries(ELM_MAP)) {
      const txt = await page.locator(v).allInnerTexts();
      res.push(`${k}: ${txt.join()}`)
    }
    return res
  }

  const messages = await scraypeMessageEnyori()
  const date = await page.locator('#lblDATE').allInnerTexts();
  await sendToSlack(`${date} 園より`, messages.join('\n'));
});