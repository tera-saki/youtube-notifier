const YouTubeNotifier = require('./YouTubeNotifier.js')

async function main() {
  try {
    const notifier = new YouTubeNotifier()
    await notifier.run()
  } catch (error) {
    console.error('Error occurred while running YouTubeNotifier:', error)
  }
}

main().then(() => process.exit(0))