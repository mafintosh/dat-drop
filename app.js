var electron = require('electron')

var win = null
var tray = null

electron.app.on('ready', function () {
  win = new electron.BrowserWindow({
    width: 800,
    height: 600
  })

  win.loadURL(`file://${__dirname}/index.html`)
  win.webContents.openDevTools()

  win.on('closed', function () {
    win = null
    tray = null
  })

  tray = new electron.Tray(`${__dirname}/icon.png`)
  tray.setToolTip('Drop files here')
  tray.on('drop-files', function (e, files) {
    win.webContents.send('drop', files)
  })
})
