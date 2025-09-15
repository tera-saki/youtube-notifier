const fs = require('node:fs')
const path = require('node:path')

const axios = require('axios')
const { DateTime } = require('luxon')

const YouTubeChannelFetcher = require('./YouTubeChannelFetcher')

class YouTubeNotifier {
  constructor() {
    const rootDir = path.join(__dirname, '..')
    const configPath = path.join(rootDir, 'config.json')
    const credentialPath = path.join(rootDir, 'credentials', 'credentials.json')
    const tokenPath = path.join(rootDir, 'credentials', 'token.json')
    const lastCheckedFilePath = path.join(rootDir, 'last_checked')

    if (!fs.existsSync(credentialPath)) {
      throw new Error(`Credential file not found: ${credentialPath}`)
    }
    if (!fs.existsSync(tokenPath)) {
      throw new Error(`Token file not found: ${tokenPath}`)
    }
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`)
    }

    this.fetcher = new YouTubeChannelFetcher({ credentialPath, tokenPath })
    this.config = JSON.parse(fs.readFileSync(configPath, { encoding: 'utf-8' }))
    this.lastCheckedFilePath = lastCheckedFilePath
  }

  getLastChecked() {
    if (!fs.existsSync(this.lastCheckedFilePath)) {
      return DateTime.local().startOf('day').toISO()
    }

    return fs.readFileSync(this.lastCheckedFilePath, { encoding: 'utf8' }).trim()
  }

  updateLastChecked(t) {
    fs.writeFileSync(this.lastCheckedFilePath, t)
  }

  validateVideo(video) {
    const exclude_words = this.config?.exclude_words ?? []
    return exclude_words.every(w => !video.title.match(w))
  }

  async notify(video) {
    const videoURL = `https://www.youtube.com/watch?v=${video.videoId}`
    let text
    if (video.liveBroadcastContent === 'upcoming') {
      const localeString = DateTime.fromISO(video.liveStreamingDetails.scheduledStartTime).toLocaleString(DateTime.DATETIME_SHORT)
      text = `:alarm_clock: ${video.channel} plans to start live at ${localeString}.\n${video.title}\n${videoURL}`
    } else if (video.liveBroadcastContent === 'live') {
      text = `:microphone: ${video.channel} is now live!\n${video.title}\n${videoURL}`
    } else if (video.liveStreamingDetails?.actualEndTime) {
      return; // Do not notify ended live streams
    } else {
      text = `:clapper: ${video.channel} uploaded a new video.\n${video.title}\n${videoURL}`
    }
    await axios.post(this.config.webhook_url, { text })
  }

  async run() {
    const start = this.getLastChecked()
    const end = DateTime.local().toISO()

    const channels = await this.fetcher.getSubscribedChannels()

    const promises = []
    for (const { id, name } of channels) {
      const promise = this.fetcher.getNewVideos(id, start, end)
        .catch(e => {
          console.error(`Failed to fetch videos from ${name}`, e)
          return []
        })
      promises.push(promise)
    }

    const videos = (await Promise.all(promises)).flat()
    for (const video of videos) {
      if (!this.validateVideo(video)) {
        continue
      }
      await this.notify(video)
    }
    this.updateLastChecked(end)
  }
}

module.exports = YouTubeNotifier