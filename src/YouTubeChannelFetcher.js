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
    const activityResponses = await this.client.activities.list({
      part: ['snippet', 'contentDetails'],
      channelId,
      publishedAfter: from,
      publishedBefore: to,
      maxResults: 10
    })

    const videoIds = activityResponses.data.items
      .filter((item) => item.snippet.type === 'upload')
      .map((item) => item.contentDetails.upload.videoId)

    const videoListResponses = await this.client.videos.list({
      part: ['snippet', 'liveStreamingDetails'],
      id: videoIds.join(',')
    })

    const videos = videoListResponses.data.items.map(video => ({
      videoId: video.id,
      title: video.snippet.title,
      channel: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      liveBroadcastContent: video.snippet.liveBroadcastContent,
      liveStreamingDetails: video.liveStreamingDetails
    }))
    console.log(videos);

    return videos
  }
}

module.exports = YouTubeChannelFetcher