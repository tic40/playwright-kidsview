import { test, expect } from '@playwright/test';
const {
  SLACK_WEBHOOK_URL,
  KIDS_VIEW_LOGIN_URL,
  KIDS_VIEW_ID,
  KIDS_VIEW_PW
} = process.env

async function sendToSlack(username: string, text: string, channel: string) {
  const slackWebhookUrl = `${SLACK_WEBHOOK_URL}`
  const data = { text, username, channel }
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };

  try {
    await fetch(slackWebhookUrl, options);
  } catch (error) {
    console.error('Error sending message to Slack:', error);
  }
}

test('get enyori and notify slack', async ({ page }) => {
  await page.goto(`${KIDS_VIEW_LOGIN_URL}`);

  // login
  await page.locator('#txtID').fill(`${KIDS_VIEW_ID}`);
  await page.locator('#txtPASS').fill(`${KIDS_VIEW_PW}`);
  await page.locator('#cmdLOGIN02').click();
  const title = await page.locator('#lblEN_NAME');
  await expect(title).toBeVisible();

  // move to 園より
  await page.locator('#grdMENU_ctl02_lnk02').click();
  const title_en = await page.locator('#pnlENJINOYOUSU');
  await expect(title_en).toBeVisible();

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
  await sendToSlack(`${date} 保育園より`, messages.join('\n'), '#保育園');
});