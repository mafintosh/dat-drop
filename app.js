var electron = require('electron')

var win = null
var tray = null

electron.app.on('ready', function () {
  win = new electron.BrowserWindow({
    width: 550,
    height: 500,
    backgroundColor: '#293648'
  })

  win.loadURL(`file://${__dirname}/index.html`)

  win.on('closed', function () {
    win = null
    tray = null
  })

  var color = electron.systemPreferences.isDarkMode()
    ? 'white'
    : 'dark'
  tray = new electron.Tray(`${__dirname}/icons/${color}.png`)
  tray.setToolTip('Drop files here')
  tray.on('drop-files', function (e, files) {
    win.webContents.send('drop', files)
  })
})

electron.app.on('will-finish-launching', function () {
  electron.app.on('open-url', function (ev, url) {
    // send the url to the renderer process via rpc
    ev.preventDefault()
  })
})
