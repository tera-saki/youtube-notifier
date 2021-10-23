const path = require('path')
const fs = require('fs')
const { google } = require('googleapis')

const credentialsDir = path.join(__dirname, '..', 'credentials')

function createClient() {
  const credentials = JSON.parse(fs.readFileSync(path.join(credentialsDir, 'credentials.json')))
  const token = JSON.parse(fs.readFileSync(path.join(credentialsDir, 'token.json')))

  const { client_secret, client_id, redirect_uris } = credentials.installed
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
  auth.setCredentials(token)
  return google.youtube({ version: 'v3', auth })
}

module.exports = {
  createClient
}