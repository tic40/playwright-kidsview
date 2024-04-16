import { test, expect } from '@playwright/test'
const {
  SLACK_WEBHOOK_URL,
  KIDS_VIEW_LOGIN_URL,
  KIDS_VIEW_ID,
  KIDS_VIEW_PW,
  NOTION_DATABASE_ID,
  NOTION_INTEGRATION_TOKEN
} = process.env

function getCurrentDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function createDiaryEntryInNotion(messageFromHome: string, messageFromNursery: string) {
  const payload = {
    parent: { database_id: NOTION_DATABASE_ID },
    properties: {
      Name: {
        title: [
          { text: { content: '日記', }, },
        ],
      },
      Date: {
        type: 'date',
        date: { start: getCurrentDate() },
      },
    },
    // diary template
    children: [
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [
            { text: { content: 'あきこ' } }
          ]
        }
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [
            { text: { content: 'たいし' } }
          ]
        }
      },
      {
        type: 'heading_2',
        heading_2: {
          rich_text: [
            { text: { content: 'いろは' } }
          ]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: '\n[家庭より]\n' }
              // annotations: { bold: true }
            },
            {
              type: 'text',
              text: { content: messageFromHome }
            },
            {
              type: 'text',
              text: { content: '\n[保育園より]\n' }
              // annotations: { bold: true }
            },
            {
              type: 'text',
              text: { content: messageFromNursery }
            },
          ],
        }
      }
    ]
  }

  const headers = {
    'Authorization': `Bearer ${NOTION_INTEGRATION_TOKEN}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  }

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error(`Failed to create diary entry: ${response.statusText}`)
  const data = await response.json()
  console.log('Diary entry created:', data)
}

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

async function getMessageFromHome(page) {
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

async function getMessageFromNursery (page) {
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

test('Get message from home and send slack', async ({ page }) => {
  const messages = await getMessageFromHome(page)
  const date = await page.locator('#lblDATE').allInnerTexts()
  const formatttedMessage = messages.length === 0 ?
    '<!channel> 今日の家庭からの入力がまだだよ'
    : `\`\`\`${messages.join('\n')}\`\`\``
  await sendToSlack(`${date} 家庭より`, formatttedMessage, '#保育園')
})

test('Get message from nursery and send slack', async ({ page }) => {
  const messages = await getMessageFromNursery(page)
  const date = await page.locator('#lblDATE').allInnerTexts()
  await sendToSlack(
    `${date} 保育園より`,
    `\`\`\`${messages.join('\n')}\`\`\``,
    '#保育園'
  )

  await createDiaryEntryInNotion((await getMessageFromHome(page)).join('\n'), messages.join('\n'))
})