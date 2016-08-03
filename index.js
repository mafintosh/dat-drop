var hyperdrive = require('hyperdrive')
var swarm = require('hyperdrive-archive-swarm')
var memdb = require('memdb')
var drop = require('drag-and-drop-files')
var file = require('random-access-file')
var electron = require('electron')
var speedometer = require('speedometer')
var basename = require('path').basename

var $ = document.querySelector.bind(document)
var db = memdb()
var drive = hyperdrive(db)
var files = {}

var archive = drive.createArchive({
  live: false,
  file: function (name) {
    return file(files[name])
  }
})

function updateUI (feed, removed) {
  var blocks = feed.blocks

  if (removed && removed.stream && removed.stream.remoteId) {
    var $old = $('#peer-' + removed.stream.remoteId.toString('hex'))
    if ($old) $old.parentNode.removeChild($old)
  }

  for (var i = 0; i < feed.peers.length; i++) {
    var have = 0
    var peer = feed.peers[i]

    if (!peer.stream || !peer.stream.remoteId) continue

    for (var j = 0; j < blocks; j++) {
      if (peer.remoteBitfield.get(j)) have++
    }

    if (!have) continue

    var id = 'peer-' + peer.stream.remoteId.toString('hex')
    var $el = $('#' + id)

    if (!$el) {
      $el = document.createElement('div')
      $el.className = 'peer'
      $el.id = id
      document.body.appendChild($el)
    }

    $el.innerText = 'Uploading to friend, ' + (100 * have / blocks).toFixed(2) + '%, Up: ' + peer.uploadSpeed() + ', Down: ' + peer.downloadSpeed()
  }
}

function ondrop (e) {
  e.forEach(function (file) {
    files[file.name] = file.path
    archive.append(file.name)
  })

  archive.finalize(function () {
    $('#status').innerText = 'Sharing ' + e.length + ' files, ' + archive.key.toString('hex')
    swarm(archive)

    archive.content.on('peer-add', function (peer) {
      peer.downloadSpeed = speedometer()
      peer.uploadSpeed = speedometer()
      updateUI(archive.content)
    })

    archive.content.on('peer-remove', function (peer) {
      updateUI(archive.content, peer)
    })

    archive.content.on('upload', function (block, data, peer) {
      peer.uploadSpeed(data.length)
    })

    archive.content.on('download', function (block, data, peer) {
      peer.downloadSpeed(data.length)
    })

    setInterval(update, 1000)

    function update () {
      updateUI(archive.content)
    }
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
