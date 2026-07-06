#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

const WORKDIR = path.resolve(__dirname, '..')
const UNIFIED = path.join(WORKDIR, 'data', 'unified_list.json')

const dmsLines = `
39°35'02.2"N 104°59'36.3"W
39°35'22.6"N 104°59'36.2"W
39°35'26.1"N 104°59'18.6"W
39°34'34.3"N 104°59'19.2"W
39°34'49.7"N 104°59'51.9"W
39°35'03.1"N 105°00'13.3"W
39°34'56.7"N 105°00'25.8"W
39°34'50.4"N 105°00'36.0"W
39°34'50.7"N 105°00'59.3"W
39°34'24.2"N 105°00'38.6"W
39°34'35.4"N 105°00'38.5"W
39°34'41.9"N 105°01'16.8"W
39°34'26.5"N 105°01'13.8"W
39°34'27.7"N 105°00'59.7"W
39°34'19.9"N 105°00'38.5"W
39°34'10.1"N 105°00'24.9"W
39°33'51.7"N 104°59'50.7"W
39°34'59.6"N 104°59'51.9"W
39°35'03.0"N 105°00'04.2"W
39°35'15.3"N 105°00'08.5"W
39°35'09.8"N 105°00'01.1"W
39°35'16.7"N 105°00'13.5"W
39°35'23.5"N 105°00'08.6"W
39°35'30.0"N 105°00'25.2"W
39°35'37.1"N 105°00'41.3"W
39°35'46.6"N 105°00'51.2"W
39°35'44.7"N 105°00'58.5"W
39°35'52.1"N 105°01'06.0"W
39°36'07.4"N 105°01'09.8"W
39°36'28.5"N 105°00'58.8"W
39°34'49.2"N 105°01'44.6"W
39°35'01.5"N 105°01'43.6"W
39°35'28.4"N 105°01'31.2"W
39°35'50.7"N 105°01'19.6"W
39°36'00.6"N 105°01'24.6"W
39°36'21.7"N 105°01'20.1"W
39°36'28.4"N 105°00'35.6"W
39°36'39.7"N 105°00'37.3"W
`.trim()

function dmsToDecimal(dms) {
  // expects e.g. 39°35'02.2"N
  const m = dms.match(/(\d+)[°\s]+(\d+)'?(\d+(?:\.\d+)?)\"?\s*([NSEW])/i)
  if (!m) return null
  const deg = Number(m[1])
  const min = Number(m[2])
  const sec = Number(m[3])
  const hemi = m[4].toUpperCase()
  let val = deg + min/60 + sec/3600
  if (hemi === 'S' || hemi === 'W') val = -val
  return val
}

const pairs = dmsLines.split(/\n+/).map(l => l.trim()).filter(Boolean)

const points = []
for (const line of pairs) {
  // split on whitespace between lat and lon
  const parts = line.split(/\s+/)
  if (parts.length < 2) {
    console.error('invalid line:', line)
    continue
  }
  const latDms = parts[0]
  const lonDms = parts[1]
  const lat = dmsToDecimal(latDms)
  const lon = dmsToDecimal(lonDms)
  if (lat == null || lon == null) {
    console.error('parse failed for', line)
    continue
  }
  points.push({lat, lon, note: line})
}

if (!fs.existsSync(UNIFIED)) {
  console.error('File not found:', UNIFIED)
  process.exit(1)
}

const dataRaw = fs.readFileSync(UNIFIED,'utf8')
let data
try { data = JSON.parse(dataRaw) } catch (e) { console.error('JSON parse error', e); process.exit(1) }

if (!Array.isArray(data.nature)) data.nature = []

// avoid exact-duplicate lat/lon
const existing = new Set(data.nature.map(p => `${p.lat},${p.lon}`))
let added = 0
for (const p of points) {
  const key = `${p.lat},${p.lon}`
  if (existing.has(key)) continue
  data.nature.push(p)
  existing.add(key)
  added++
}

fs.writeFileSync(UNIFIED, JSON.stringify(data, null, 2), 'utf8')
console.log(`Appended ${added} nature points to ${UNIFIED}`)
