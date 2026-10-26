/**
 * SUPER MÁS ERP/POS — ZIP (formato PKZIP, deflate) para el envío a la DIAN y la entrega al adquiriente.
 * Implementación mínima con node:zlib (sin dependencias externas).
 */

import { deflateRawSync, inflateRawSync } from 'zlib'

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | (Math.floor(d.getSeconds() / 2) & 0x1f),
    date: (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0x0f) << 5) | (d.getDate() & 0x1f),
  }
}

/** Crea un ZIP con un único archivo. */
export function zipSingleFile(fileName: string, content: Buffer | string, when = new Date()): Buffer {
  return zipFiles([{ fileName, content }], when)
}

/** Crea un ZIP con varios archivos (paquete de entrega al adquiriente: XML + PDF). */
export function zipFiles(entries: Array<{ fileName: string; content: Buffer | string }>, when = new Date()): Buffer {
  const { time, date } = dosDateTime(when)
  const locals: Buffer[] = []
  const centrals: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const data = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content, 'utf8')
    const name = Buffer.from(entry.fileName, 'utf8')
    const compressed = deflateRawSync(data)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // versión necesaria
    local.writeUInt16LE(0x0800, 6) // UTF-8
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(time, 12)
    central.writeUInt16LE(date, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42) // offset del encabezado local

    locals.push(local, name, compressed)
    centrals.push(central, name)
    offset += local.length + name.length + compressed.length
  }

  const centralDir = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDir.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...locals, centralDir, end])
}

/** Lee el primer archivo de un ZIP (para la respuesta de la DIAN en GetStatusZip). */
export function unzipFirstFile(zip: Buffer): { fileName: string; content: Buffer } | null {
  if (zip.length < 30 || zip.readUInt32LE(0) !== 0x04034b50) return null
  const flags = zip.readUInt16LE(6)
  const method = zip.readUInt16LE(8)
  let compSize = zip.readUInt32LE(18)
  const nameLen = zip.readUInt16LE(26)
  const extraLen = zip.readUInt16LE(28)
  const fileName = zip.subarray(30, 30 + nameLen).toString('utf8')
  const start = 30 + nameLen + extraLen
  if (flags & 0x08 || compSize === 0) {
    // Tamaño en el directorio central
    const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
    if (eocd < 0) return null
    const cdOffset = zip.readUInt32LE(eocd + 16)
    compSize = zip.readUInt32LE(cdOffset + 20)
  }
  const raw = zip.subarray(start, start + compSize)
  const content = method === 0 ? Buffer.from(raw) : inflateRawSync(raw)
  return { fileName, content }
}
