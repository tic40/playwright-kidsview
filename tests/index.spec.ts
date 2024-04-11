import { test, expect } from '@playwright/test'
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
  }

  try {
    await fetch(slackWebhookUrl, options)
  } catch (error) {
    console.error('Error sending message to Slack:', error)
  }
}

test('Get message from home and send slack', async ({ page }) => {
  await page.goto(`${KIDS_VIEW_LOGIN_URL}`)

  // login
  await page.locator('#txtID').fill(`${KIDS_VIEW_ID}`)
  await page.locator('#txtPASS').fill(`${KIDS_VIEW_PW}`)
  await page.locator('#cmdLOGIN02').click()
  const title = page.locator('#lblEN_NAME')
  await expect(title).toBeVisible()

  // move to 家庭より
  await page.locator('#grdMENU_ctl02_pnl_naka03').click()
  const panel = page.locator('#pnlKATEINOYOUSU')
  await expect(panel).toBeVisible()

  // 前日に移動
  // await page.locator('#cmdBEFORE').click()
  // const a = await page.locator('#pnlKATEINOYOUSU')
  // await expect(a).toBeVisible()

  const scraypeMessage = async () => {
    const getSelectedValue = async (id: string) => {
      return await page.$eval(id, v => v.options[v.options.selectedIndex].textContent)
    }
    const temp1 = await getSelectedValue('#ddlTEMPERATURE1')
    const temp2 = await getSelectedValue('#ddlTEMPERATURE2')
    const sleep11 = await getSelectedValue('#ddlSLEEP11')
    const sleep12 = await getSelectedValue('#ddlSLEEP12')
    const sleep21 = await getSelectedValue('#ddlSLEEP21')
    const sleep22 = await getSelectedValue('#ddlSLEEP22')
    const medicine = await getSelectedValue('#grdFREE_ctl02_ddlNAIYO')
    const comment = await page.$eval('#txtCOMMENT', v => v.value)

    if (!temp1) {
      return []
    } else {
      return [
        `体温: ${temp1}.${temp2}度`,
        `睡眠: ${sleep11}:${sleep12} 〜 ${sleep21}:${sleep22}`,
        `お薬: ${medicine}`,
        `コメント: ${comment}`
      ]
    }
  }

  const messages = await scraypeMessage()
  const date = await page.locator('#lblDATE').allInnerTexts()
  const formatttedMessage = messages.length === 0 ?
    '<!channel> 今日の家庭からの入力がまだだよ'
    : `\`\`\`${messages.join('\n')}\`\`\``

  await sendToSlack(`${date} 家庭より`, formatttedMessage, '#保育園')
})

test('Get message from nursery and send slack', async ({ page }) => {
  await page.goto(`${KIDS_VIEW_LOGIN_URL}`)

  // login
  await page.locator('#txtID').fill(`${KIDS_VIEW_ID}`)
  await page.locator('#txtPASS').fill(`${KIDS_VIEW_PW}`)
  await page.locator('#cmdLOGIN02').click()
  const title = page.locator('#lblEN_NAME')
  await expect(title).toBeVisible()

  // move to 園より
  await page.locator('#grdMENU_ctl02_lnk02').click()
  const panel = page.locator('#pnlENJINOYOUSU')
  await expect(panel).toBeVisible()

  const scraypeMessage = async () => {
    const ELM_MAP = {
      '記入': '#lblSTAFF_NAME',
      '体温': '#lblTEMPERATURE1',
      '睡眠': '#lblGOSUI',
      '機嫌': '#lblMOOD',
      '食事': '#lblMEAL',
      '排泄': '#lblEXCRETION1',
      'コメント': '#lblCOMMENT'
    }
    let res: string[] = []
    for(const [k,v] of Object.entries(ELM_MAP)) {
      const txt = await page.locator(v).allInnerTexts()
      res.push(`${k}: ${txt.join()}`)
    }
    return res
  }

  const messages = await scraypeMessage()
  const date = await page.locator('#lblDATE').allInnerTexts()
  await sendToSlack(
    `${date} 保育園より`,
    `\`\`\`${messages.join('\n')}\`\`\``,
    '#保育園'
  )
})
