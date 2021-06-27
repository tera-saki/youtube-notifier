const fs = require('fs')
const path = require('path')
const { DateTime } = require('luxon')

const lastCheckedFile = path.join(__dirname, '..', 'last_checked')

function getLastChecked() {
  if (!fs.existsSync(lastCheckedFile)) {
    return DateTime.local().startOf('day').toISO()
  }

  return fs.readFileSync(lastCheckedFile, { encoding: 'utf8' }).trim()
}
  
function updateLastChecked(t) {
  fs.writeFileSync(lastCheckedFile, t)
}

module.exports = {
  getLastChecked,
  updateLastChecked
}