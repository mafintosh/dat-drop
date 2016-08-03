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
var catLength = 7
var catOffset = Math.floor(Math.random() * catLength)

var archive = drive.createArchive({
  live: false,
  file: function (name) {
    return file(files[name])
  }
})

function updateUI (feed, removed) {
  var blocks = feed.blocks
  var peers = []

  if (removed && removed.stream && removed.stream.remoteId) {
    var $old = $('#friend-' + removed.stream.remoteId.toString('hex'))
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

    peers.push(peer)

    var id = 'friend-' + peer.stream.remoteId.toString('hex')
    var $el = $('#' + id)

    if (!$el) {
      $el = document.createElement('div')
      $el.className = 'friend'
      $el.id = id

      if (catOffset === catLength) catOffset = 0
      var cat = catOffset++ + 1
      $el.style.backgroundImage = 'url(file://' + __dirname + '/images/cat-' + catOffset + '.png'
      document.querySelector('#network').appendChild($el)
    }

    $el.innerText = (100 * have / blocks).toFixed(2) + '%'
  }

  updatePos(peers)
}

function updatePos (peers) {
  var wid = 40
  var q = Math.PI / 2
  var friends = peers.length

  var elHei = document.querySelector('#network').offsetHeight
  var elWid = document.querySelector('#network').offsetWidth
  var factor = Math.min(elWid, elHei) * 0.8

  for (var i = 0; i < friends; i++) {
    var id = '#friend-' + peers[i].stream.remoteId.toString('hex')
    var el = document.querySelector(id)
    var offset = (Math.PI - q) / 2
    var range = Math.PI + offset + (i + 1) * (q / (friends + 1))

    el.style.left = Math.floor(Math.floor(elWid / 2) + factor * Math.cos(range) - wid) + 'px'
    el.style.top = Math.floor(factor * Math.sin(range) - 3 * wid + factor + elHei - 2 * elHei / 3) + 'px'
  }

  document.querySelector('#me').style.left = Math.floor(elWid / 2) - wid + 'px'
  document.querySelector('#me').style.top = Math.floor(elHei - 3 * wid) + 'px'
}

function ondrop (e) {
  e.forEach(function (file) {
    files[file.name] = file.path
    archive.append(file.name)
  })

  archive.finalize(function () {
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
    swarm(archive)
    $('#status').innerText = 'Sharing ' + e.length + ' files, ' + archive.key.toString('hex')

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
