const fs = require('fs')
const path = require('path')

const config = getÇonfig()

function getÇonfig() {
  const configPath = path.join(__dirname, '..', 'config.json')
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, { encoding: 'utf-8' }))
  } else {
    return null
  }
}

function validateVideo(video) {
  const exclude_words = config?.exclude_words ?? []
  return exclude_words.every(w => !video.title.match(w))
}

module.exports = {
  validateVideo
}