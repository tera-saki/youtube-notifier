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
    const statusFilePath = path.join(rootDir, 'channel_status.json')

    if (!fs.existsSync(credentialPath)) {
      throw new Error(`Credential file not found: ${credentialPath}`)
    }
    if (!fs.existsSync(tokenPath)) {
      throw new Error(`Token file not found: ${tokenPath}`)
    }
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`)
    }

    if (!fs.existsSync(statusFilePath)) {
      fs.writeFileSync(statusFilePath, '{}', { encoding: 'utf-8' })
    }

    this.fetcher = new YouTubeChannelFetcher({ credentialPath, tokenPath })
    this.config = JSON.parse(fs.readFileSync(configPath, { encoding: 'utf-8' }))
    this.statusFilePath = statusFilePath
  }

  getChannelStatus() {
    return JSON.parse(fs.readFileSync(this.statusFilePath, { encoding: 'utf-8' }))
  }

  updateChannelStatus(updated) {
    const status = this.getChannelStatus()
    for (const [k, v] of Object.entries(updated)) {
      if (!status[k]) {
        status[k] = {}
      }
      status[k] = { ...status[k], ...v }
    }
    fs.writeFileSync(this.statusFilePath, JSON.stringify(status, null, 2), { encoding: 'utf-8' })
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
      text = `:alarm_clock: ${video.channelTitle} plans to start live at ${localeString}.\n${video.title}\n${videoURL}`
    } else if (video.liveBroadcastContent === 'live') {
      text = `:microphone: ${video.channelTitle} is now live!\n${video.title}\n${videoURL}`
    } else if (video.liveStreamingDetails?.actualEndTime) {
      return; // Do not notify ended live streams
    } else {
      text = `:clapper: ${video.channelTitle} uploaded a new video.\n${video.title}\n${videoURL}`
    }
    await axios.post(this.config.webhook_url, { text })
  }

  async run() {
    const channels = await this.fetcher.getSubscribedChannels()
    const channelStatus = this.getChannelStatus()

    const promises = []
    for (const { id, name } of channels) {
      const start = channelStatus[id]?.last_published_at ?? DateTime.now().minus({ days: 1 }).toISO()
      const promise = this.fetcher.getNewVideos(id, start)
        .catch(e => {
          console.error(`Failed to fetch videos from ${name}`, e)
          return []
        })
      promises.push(promise)
    }

    const videos = (await Promise.all(promises)).flat()
    const updated = {}
    for (const video of videos) {
      if (this.validateVideo(video)) {
        await this.notify(video)
      }
      // update last_published_at even if the video is excluded not to call videos.list API again
      updated[video.channelId] = { last_published_at: video.publishedAt }
    }
    if (Object.keys(updated).length > 0) {
      this.updateChannelStatus(updated)
    }
  }
}

module.exports = YouTubeNotifier