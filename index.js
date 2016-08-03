var hyperdrive = require('hyperdrive')
var swarm = require('hyperdrive-archive-swarm')
var memdb = require('memdb')
var drop = require('drag-and-drop-files')
var file = require('random-access-file')
var electron = require('electron')
var basename = require('path').basename

var db = memdb()
var drive = hyperdrive(db)
var files = {}

var archive = drive.createArchive({
  file: function (name) {
    return file(files[name])
  }
})

function ondrop (e) {
  e.forEach(function (file) {
    files[file.name] = file.path
    archive.append(file.name)
  })

  archive.finalize(function () {
    archive.list().on('data', console.log.bind(console))
    console.log('finalized')
  })
}

drop(document.body, ondrop)
electron.ipcRenderer.on('drop', function (e, files) {
  ondrop(files.map(function (path) {
    return {
      name: basename(path),
      path: path
    }
  }))
})
