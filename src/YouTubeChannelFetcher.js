const axios = require('axios')
const { DateTime } = require('luxon')
const xml2js = require('xml2js')

const YouTubeClient = require('./YouTubeClient')

class YouTubeChannelFetcher {
  constructor({ credentialPath, tokenPath }) {
    this.client = new YouTubeClient(credentialPath, tokenPath).createClient();
  }

  // Get the list of subscribed channels
  async getSubscribedChannels() {
    let channels = [];
    let pageToken = null;

    do {
      const res = await this.client.subscriptions.list({
        part: ['snippet'],
        mine: true,
        maxResults: 50
      });
      channels = [...res.data.items, ...channels];
      pageToken = res.nextPageToken;
    } while (pageToken);

    return channels.map(c => ({
      id: c.snippet.resourceId.channelId,
      name: c.snippet.title
    }));
  }

  // Get new videos from a channel between 'from' and 'to' timestamps
  async getNewVideos(channelId, from, to) {
    const { items } = (
      await this.client.activities.list({
        part: ['snippet', 'contentDetails'],
        channelId,
        publishedAfter: from,
        publishedBefore: to,
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

  // Get a new live stream from a channel published after 'from' timestamp
  async getNewStreams(channelId, from) {
    const videoId = await this._getNewVideoFromRSS(channelId, from)
    if (!videoId) {
      return []
    }

    const videoListResponse = await this.client.videos.list({
      part: ['snippet', 'liveStreamingDetails'],
      id: videoId
    })
    const video = videoListResponse.data.items[0]
    if (!video.liveStreamingDetails) {
      return []
    }
    
    return [
      {
        title: video.snippet.title,
        channel: video.snippet.channelTitle,
        videoId,
        scheduledStartTime: DateTime.fromISO(video.liveStreamingDetails.scheduledStartTime).toLocaleString(DateTime.DATETIME_SHORT)
      }
    ]
  }

  // Get latest video from RSS feed
  // NOTE: we need to use search.list API to get upcoming or online live streams,
  // but it has heavy quota cost.
  // so use RSS feed to poll for new live streams.
  // (there is also quota cost for RSS feed, we should not poll too frequently)
  async _getNewVideoFromRSS(channelId, from) {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const res = await axios.get(rssUrl)
    
    const parsed = await xml2js.parseStringPromise(res.data)
    const latestEntry = parsed.feed.entry?.[0]
    
    if (!latestEntry) {
      return null
    }

    const publishedAt = DateTime.fromISO(latestEntry.published[0])
    if (publishedAt < DateTime.fromISO(from)) {
      return null
    }

    const videoId = latestEntry['yt:videoId'][0]
    return videoId
  }
}

module.exports = YouTubeChannelFetcher