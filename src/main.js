const path = require('path')
const fs = require('fs')
const { DateTime } = require('luxon')
const { google } = require('googleapis')

const { getLastChecked, updateLastChecked } = require('./timer')
const { notify } = require('./notifier')

const credentialsDir = path.join(__dirname, '..', 'credentials')

function createClient() {
  const credentials = JSON.parse(fs.readFileSync(path.join(credentialsDir, 'credentials.json')))
  const token = JSON.parse(fs.readFileSync(path.join(credentialsDir, 'token.json')))

  const { client_secret, client_id, redirect_uris } = credentials.installed
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
  auth.setCredentials(token)
  return google.youtube({ version: 'v3', auth })
}

async function getSubscribedChannels(client) {
  let channels = []
  let pageToken = null

  do {
    const res = await client.subscriptions.list({
      part: ['id', 'snippet', 'contentDetails'],
      mine: true,
      maxResults: 50
    })
    channels = [...res.data.items, ...channels]
    pageToken = res.nextPageToken
  } while (pageToken)

  return channels.map(c => ({
    id: c.snippet.resourceId.channelId,
    name: c.snippet.title
  }))
}

async function getNewVideos(client, channelId, start, end) {
  const { items } = (
    await client.activities.list({
      part: ['snippet', 'contentDetails'],
      channelId,
      publishedAfter: start,
      publishedBefore: end,
      maxResults: 10
    })
  ).data

  return items.filter((item) => item.snippet.type === 'upload')
    .map(({ snippet, contentDetails }) => {
      return {
        title: snippet.title,
        channel: snippet.channelTitle,
        videoId: contentDetails.upload.videoId
      }
    })
}

async function main() {
  const videos = []
  
  const start = getLastChecked()
  const end = DateTime.local().toISO()

  const client = createClient()
  const channels = await getSubscribedChannels(client)
  
  for (const { id, name } of channels) {
    try {
      const v = await getNewVideos(client, id, start, end)
      videos.push(...v)
    } catch (e) {
      console.error(`Failed to fetch videos from ${name}`, e)
    }
  }
  if (videos.length > 0) {
    await notify(videos)
  }
  updateLastChecked(end)
}

main().then(() => process.exit(0))