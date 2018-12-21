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

export default function(){
  let signInData = {}

  function withSignedInUser(fn){
    return (...args) => {
      if(isEmpty(signInData)){
        throw new Error('[NuBank] You must sign in first')
      }

      return fn(...args)
    }
  }

  return {
    setLoginToken: (token) => { signInData = token },
    getLoginToken: async({ password, login }) => {
      const browser = await puppeteer.launch({ headless: false, slowMo: 1 })
      const page = await browser.newPage()
      page.setViewport({ width: 1440, height: 900 })
      await page.goto('http://localhost:3000')
      await page.type('input#login_cpf', '11111111111')
      await page.type('input#login_emp_number', '1111111')
      // await page.goto(apiURIs.webLogin)
      // await page.type('input#username', login)
      // await page.type('input#input_001', password)
      await page.$eval('input[type=submit]', (el) => { el.click() })
      await page.waitForSelector('div.logo img')
      // await page.waitForSelector('div.qr-code img')

      const image = await page.$('div.logo img')
      // const image = await page.$('div.qr-code img')
      // await image.screenshot({ path: 'qrcode.png' })
      const imgBuffer = await image.screenshot()
      await browser.close()

      console.log(await terminalImage.buffer(imgBuffer))

      // fetch(apiURIs.token, {
      //   body: JSON.stringify({
      //     password,
      //     login,
      //     grant_type: 'password',
      //     client_id: 'other.conta',
      //     client_secret: 'yQPeLzoHuJzlMMSAjC-LgNUJdUecx8XO',
      //   }),
      //   method: 'POST',
      //   headers: {
      //     ...REQUEST_HEADERS_SAUCE,
      //   },
      // })
      //   .then(res => res.json())
      //   /* eslint-disable no-return-assign */
      //   .then(data => signInData = data)
      //   /* eslint-enable no-return-assign */
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
