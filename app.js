var electron = require('electron')

var win = null

electron.app.on('ready', function () {
  win = new electron.BrowserWindow({
    width: 800,
    height: 600
  })

  win.loadURL(`file://${__dirname}/index.html`)

  win.on('closed', function () {
    win = null
  })
})
