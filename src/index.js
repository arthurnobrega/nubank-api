import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { isEmpty } from 'lodash'
import puppeteer from 'puppeteer'
import terminalImage from 'terminal-image'
import apiURIs from './api_uris'

/* eslint-disable quote-props */
export const REQUEST_HEADERS_SAUCE = {
  'Content-Type': 'application/json',
  'X-Correlation-Id': 'WEB-APP.jO4x1',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36',
  'Origin': 'https://conta.nubank.com.br',
  'Referer': 'https://conta.nubank.com.br/',
}
/* eslint-enable quote-props */

export default function() {
  let signInData = {}
  let validated = false
  let validationData = false

  function withSignedInUser(fn) {
    return (...args) => {
      if (isEmpty(signInData)) {
        throw new Error('[NuBank] You must sign in first')
      }

      return fn(...args)
    }
  }

  const sleep = ms => (new Promise(resolve => setTimeout(resolve, ms)))

  const validateToken = async() => {
    const response = await fetch(apiURIs.tokenValidation, {
      body: JSON.stringify(validationData),
      method: 'POST',
      headers: {
        ...REQUEST_HEADERS_SAUCE,
        Authorization: `Bearer ${signInData.access_token}`,
      },
    })

    console.log('###################')
    console.log(JSON.stringify(response))
    console.log('###################')
    if (!response.ok) {
      return false
    }

    return response.json()
  }

  return {
    setLoginToken: (token) => {
      signInData = token
      validated = true
    },
    getLoginToken: async({ password, login }) => {
      const response = await fetch(apiURIs.token, {
        body: JSON.stringify({
          password,
          login,
          grant_type: 'password',
          client_id: 'other.conta',
          client_secret: 'yQPeLzoHuJzlMMSAjC-LgNUJdUecx8XO',
        }),
        method: 'POST',
        headers: {
          ...REQUEST_HEADERS_SAUCE,
        },
      })

      signInData = await response.json()
      if ('_links' in signInData && 'events' in signInData._links) {
        validated = true
        return signInData
      }

      // QRCODE
      // start puppeteer
      const browser = await puppeteer.launch({ headless: false, slowMo: 1 })
      const page = await browser.newPage()

      // setup XHR snifer
      await page.setRequestInterception(true)
      page.on('request', (request) => {
        if (request.url() === apiURIs.tokenValidation && request.method() === 'POST') {
          validationData = request.postData()
        }
        request.continue()
      })

      // login
      await page.goto(apiURIs.webLogin)
      await page.type('input#username', login)
      await page.type('input#input_001', password)
      await page.$eval('button[type=submit]', (el) => { el.click() })

      // await qrcode to appear and copy image
      await page.waitForSelector('div.qr-code img')
      await sleep(1500)
      const image = await page.$('div.qr-code')
      const padding = 10
      const clip = Object.assign({}, await image.boundingBox())
      clip.x -= padding
      clip.y -= padding
      clip.width += padding * 2
      clip.height += padding * 2

      const imgBuffer = await image.screenshot({ path: 'screenshot.png', clip })

      console.log(await terminalImage.buffer(imgBuffer))

      // wait until discovers validationData
      let limit = 120
      while(limit > 0 && !validationData) {
        limit--
        await sleep(500)
      }

      if (!validationData) {
        return { error: 'COULDNT GET VALIDATION DATA' }
      }

      // ensure tokens validation
      console.log('###################')
      console.log('token validation')
      console.log('###################')
      limit = 20
      while(limit > 0 && !validated) {
        console.log('###################')
        const data = await validateToken()
        console.log(data)
        // if (data) {
        //   signInData = data
        //   validated = true
        // }
        limit--
        await sleep(1000)
        console.log(limit)
        console.log('###################')
      }

      await browser.close()

      if (!validated) {
        return { error: 'QRCODE NOT VALIDATED' }
      }

      return signInData
    },

    /**
     * Fetches user related data
     * @return {object} customer
    */
    @withSignedInUser
    getCustomer: () => (
      fetch(apiURIs.customers, {
        headers: {
          ...REQUEST_HEADERS_SAUCE,
          Authorization: `Bearer ${signInData.access_token}`,
        },
      })
        .then(res => res.json())
    ),

    /**
     * Fetches credit card account related data
     * @return {object} account
    */
    @withSignedInUser
    getCustomerAccount: () => (
      fetch(signInData._links.account.href, {
        headers: {
          ...REQUEST_HEADERS_SAUCE,
          Authorization: `Bearer ${signInData.access_token}`,
        },
      })
        .then(res => res.json())
    ),

    /**
     * Fetches all transaction history since the very beginning
     * @returns {object} history
    */
    @withSignedInUser
    getWholeFeed: () => (
      fetch(signInData._links.events.href, {
        headers: {
          ...REQUEST_HEADERS_SAUCE,
          Authorization: `Bearer ${signInData.access_token}`,
        },
      }).then(res => res.json())
    ),

    /**
     * Fetches all transactions from bill on specific month
     * @returns {object} history
    */
    @withSignedInUser
    getBillByMonth: monthFilter => (
      fetch(signInData._links.bills_summary.href, {
        headers: {
          ...REQUEST_HEADERS_SAUCE,
          Authorization: `Bearer ${signInData.access_token}`,
        },
      })
        .then(res => res.json())
        .then((json) => {
          const theBill = json.bills.find(bill => bill.summary.open_date.indexOf(monthFilter) !== -1)

          return fetch(theBill._links.self.href, {
            headers: {
              ...REQUEST_HEADERS_SAUCE,
              Authorization: `Bearer ${signInData.access_token}`,
            },
          })
        })
        .then(res => res.json())
    ),

    @withSignedInUser
    getCheckingBalance: () => {
      const graphql = fs.readFileSync(path.join(__dirname, 'queries', 'account_balance.gql'), 'utf8')

      return fetch(signInData._links.ghostflame.href, {
        method: 'POST',
        headers: {
          ...REQUEST_HEADERS_SAUCE,
          Authorization: `Bearer ${signInData.access_token}`,
        },
        body: JSON.stringify({ query: graphql }),
      })
        .then(res => res.json())
    },

    @withSignedInUser
    getCheckingTransactions: () => {
      const graphql = fs.readFileSync(path.join(__dirname, 'queries', 'account_feed.gql'), 'utf8')

      return fetch(signInData._links.ghostflame.href, {
        method: 'POST',
        headers: {
          ...REQUEST_HEADERS_SAUCE,
          Authorization: `Bearer ${signInData.access_token}`,
        },
        body: JSON.stringify({ query: graphql }),
      })
        .then(res => res.json())
    },

    get signInData() { return signInData },
  }
}
