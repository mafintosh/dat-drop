var hyperdrive = require('hyperdrive')
var discovery = require('discovery-swarm')
var defaults = require('datland-swarm-defaults')
var memdb = require('memdb')
var drop = require('drag-and-drop-files')
var file = require('random-access-file')
var electron = require('electron')
var speedometer = require('speedometer')
var fs = require('fs')
var basename = require('path').basename

var $ = document.querySelector.bind(document)
var $me = $('#me')
var $network = $('#network')

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

drop(document.body, ondrop)
electron.ipcRenderer.on('drop', function (e, files) {
  ondrop(files.map(function (path) {
    return {
      name: basename(path),
      path: path
    }
  }))
})

updatePos([])

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
      if (catOffset === catLength) catOffset = 0
      var cat = catOffset++ + 1
      var catUrl = 'file://' + __dirname + '/images/cat-' + catOffset + '.png'
      var html = `
        <div class="dat-progress-circle" style="animation-delay: 0s">
          <div class="dat-progress-circle__avatar">
            <img src="${catUrl}" />
          </div>
        </div>
      `

      $el = document.createElement('div')
      $el.innerHTML = html
      $el.className = 'friend'
      $el.id = id

      $network.appendChild($el)
    }

    updateProgressBar($el, have, blocks)
  }

  updatePos(peers)
}

function updatePos (peers) {
  var wid = 40
  var q = Math.PI / 2
  var friends = peers.length

  var elHei = $network.offsetHeight
  var elWid = $network.offsetWidth
  var factor = Math.min(elWid, elHei) * 0.8

  for (var i = 0; i < friends; i++) {
    var el = $('#friend-' + peers[i].stream.remoteId.toString('hex'))
    var offset = (Math.PI - q) / 2
    var range = Math.PI + offset + (i + 1) * (q / (friends + 1))

    el.style.left = Math.floor(Math.floor(elWid / 2) + factor * Math.cos(range) - wid) + 'px'
    el.style.top = Math.floor(factor * Math.sin(range) - 3 * wid + factor + elHei - 2 * elHei / 3) + 'px'
  }

  $me.style.left = Math.floor(elWid / 2) - 60 + 'px'
  $me.style.top = Math.floor(elHei - 3 * 60) + 'px'
}

function ondrop (dropped) {
  var cnt = dropped.length
  var size = 0
  var imported = 0

  dropped.forEach(function (file) { // TODO: wont work for dirs ...
    size += file.size
  })

  archive.open(loop)

  function loop () {
    var file = dropped.shift()
    if (!file) return finalize()

    files[file.name] = file.path

    var ws = archive.createFileWriteStream({type: 'file', name: file.name}, {indexing: true})
    var rs = fs.createReadStream(file.path)

    rs.pipe(ws).on('finish', loop)
    rs.on('data', onprogress)
  }

  function onprogress (data) {
    imported += data.length
    updateProgressBar($me, imported, size)
  }

  function finalize () {
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
      replicate(archive)
      $('#status').innerHTML = 'Sharing ' + cnt + ' files, <a href="dat://' + archive.key.toString('hex') + '">dat://' + archive.key.toString('hex') + '</a>'

      function update () {
        updateUI(archive.content)
      }
    })
  }
}

function updateProgressBar ($el, fetched, total) {
  $el.querySelector('.dat-progress-circle').style.animationDelay = -(100 * fetched / total) + 's'
  if (fetched === total) $el.classList.add('bounce-once')
}

function replicate (archive) {
  var swarm = discovery(defaults({
    hash: false,
    stream: function () {
      return archive.replicate()
    }
  }))

  swarm.join(archive.discoveryKey)
  swarm.once('error', function () {
    swarm.listen(0)
  })

  swarm.listen(3282)
}
