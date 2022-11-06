const { DateTime } = require('luxon')

const { createClient } = require('./client')
const { getLastChecked, updateLastChecked } = require('./timer')
const { validateVideo } = require('./validater')
const { notify } = require('./notifier')

async function getSubscribedChannels(client) {
  let channels = []
  let pageToken = null

  do {
    const res = await client.subscriptions.list({
      part: ['snippet'],
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

  return items.filter((item) => item.snippet.type === 'upload' && item.snippet.channelTitle)
    .map(({ snippet, contentDetails }) => {
      return {
        title: snippet.title,
        channel: snippet.channelTitle,
        videoId: contentDetails.upload.videoId
      }
    })
}

async function main() {
  const start = getLastChecked()
  const end = DateTime.local().toISO()

  const client = createClient()
  const channels = await getSubscribedChannels(client)

  const promises = []
  for (const { id, name } of channels) {
    const promise = getNewVideos(client, id, start, end)
      .catch(e => {
        console.error(`Failed to fetch videos from ${name}`, e)
        return []
      })
    promises.push(promise)
  }
  const videos = (await Promise.all(promises)).flat()
    .filter(video => validateVideo(video))
  if (videos.length > 0) {
    await notify(videos)
  }
  updateLastChecked(end)
}

main().then(() => process.exit(0))