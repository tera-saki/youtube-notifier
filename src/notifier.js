const axios = require('axios')

const { webhook_url } = require('../credentials/slack.json')

async function notify(videos) {
  const videoURL = (id) => `https://www.youtube.com/watch?v=${id}`
  const text = (v) => `${v.title} (${v.channel})\n${videoURL(v.videoId)}`

  for (const video of videos) {
    await axios.post(webhook_url, {
      text: text(video)
    })
  }
}

module.exports = {
  notify
}